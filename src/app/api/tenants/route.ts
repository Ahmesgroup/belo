// ============================================================
// app/api/tenants/route.ts
// POST /api/tenants        → inscription nouveau salon (gérant)
// GET  /api/tenants        → liste des salons (public, avec filtres)
//
// app/api/tenants/[id]/route.ts
// GET    /api/tenants/:id  → profil public du salon
// PATCH  /api/tenants/:id  → mise à jour profil (gérant)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/infrastructure/db/prisma";
import { withAuth, withRole, withTenant } from "@/lib/route-auth";
import { zodErrorResponse } from "@/lib/zod-formatter";
import { handleRouteError, AppErrors } from "@/shared/errors";
import { rateLimit } from "@/lib/rate-limit";
import { getCorsHeaders } from "@/lib/cors";

// ── SCHEMAS ───────────────────────────────────────────────────

const CreateTenantSchema = z.object({
  name: z
    .string()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(100, "Le nom est trop long"),
  phone: z
    .string()
    .min(8, "Numéro trop court")
    .regex(/^\+?[0-9\s\-().]+$/, "Numéro invalide"),
  whatsapp: z.string().optional(),
  email: z.string().email("Email invalide").optional(),
  address: z.string().min(5, "Adresse trop courte"),
  city: z.string().min(2, "Ville requise"),
  country: z.string().length(2).default("SN"),
  description: z.string().max(1000).optional(),
  category: z.enum([
    "NAILS", "MASSAGE", "HAIR", "BARBER", "SPA",
    "BEAUTY", "MAKEUP", "WAXING", "EYELASH", "OTHER",
  ]).optional(),
});

const UpdateTenantSchema = CreateTenantSchema.partial().extend({
  facebook:    z.string().url().optional().nullable(),
  instagram:   z.string().optional().nullable(),
  tiktok:      z.string().optional().nullable(),
  website:     z.string().url().optional().nullable(),
  depositEnabled:  z.boolean().optional(),
  depositPercent:  z.number().int().min(10).max(100).optional(),
  customDomain:    z.string().optional().nullable(),
});

const GetTenantsSchema = z.object({
  city:      z.string().optional(),
  category:  z.string().optional(),
  plan:      z.enum(["FREE", "PRO", "PREMIUM"]).optional(),
  search:    z.string().max(100).optional(),
  page:      z.coerce.number().int().positive().default(1),
  pageSize:  z.coerce.number().int().min(1).max(50).default(20),
});

// ── GET /api/tenants ─────────────────────────────────────────
// Publique — liste des salons actifs pour le listing

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = GetTenantsSchema.safeParse({
      city:     searchParams.get("city") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      plan:     searchParams.get("plan") ?? undefined,
      search:   searchParams.get("search") ?? undefined,
      page:     searchParams.get("page") ?? 1,
      pageSize: searchParams.get("pageSize") ?? 20,
    });

    if (!parsed.success) {
      return NextResponse.json(zodErrorResponse(parsed.error), { status: 422 });
    }

    const { city, category, plan, search, page, pageSize } = parsed.data;

    const where = {
      status: "ACTIVE" as const,
      ...(city ? { city: { contains: city, mode: "insensitive" as const } } : {}),
      ...(plan ? { plan: plan as any } : {}),
      ...(category ? { services: { some: { category: category as string, isActive: true } } } : {}),
      ...(search ? {
        OR: [
          { name:    { contains: search, mode: "insensitive" as const } },
          { address: { contains: search, mode: "insensitive" as const } },
        ],
      } : {}),
    };

    // Trier par plan (PREMIUM en premier, puis PRO, puis FREE)
    // puis par note moyenne
    const planOrder = { PREMIUM: 0, PRO: 1, FREE: 2 };

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        select: {
          id:          true,
          name:        true,
          slug:        true,
          city:        true,
          country:     true,
          address:     true,
          photos:      true,
          coverUrl:    true,
          plan:        true,
          _count: {
            select: {
              bookings: true,
            },
          },
        },
        skip:  (page - 1) * pageSize,
        take:  pageSize,
        orderBy: [
          // PREMIUM d'abord — position TOP listing
          { plan: "desc" },
          { createdAt: "desc" },
        ],
      }),
      prisma.tenant.count({ where }),
    ]);

    return NextResponse.json({
      data: {
        tenants,
        pagination: {
          page, pageSize, total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    }, {
      headers: {
        ...getCorsHeaders(req),
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

// ── POST /api/tenants ─────────────────────────────────────────
// Inscription d'un nouveau salon
// Le gérant doit être connecté (USER existant avec rôle CLIENT)
// → crée le Tenant + upgrade le User en OWNER

export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimit(req, { max: 5, windowMs: 60 * 60 * 1000 });
    if (limited) return NextResponse.json(AppErrors.RATE_LIMITED().toJSON(), { status: 429 });

    const auth = await withAuth(req);
    if (!auth.ok) return NextResponse.json(AppErrors.UNAUTHORIZED().toJSON(), { status: 401 });

    // Un user ne peut avoir qu'un seul salon
    if (auth.tenantId) {
      return NextResponse.json(
        { error: { code: "ALREADY_HAS_SALON", message: "Vous avez déjà un salon enregistré." } },
        { status: 409 }
      );
    }

    const raw = await req.json().catch(() => null);
    if (!raw) return NextResponse.json(AppErrors.INVALID_JSON().toJSON(), { status: 400 });

    const parsed = CreateTenantSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(zodErrorResponse(parsed.error), { status: 422 });
    }

    // Générer le slug unique
    const baseSlug = parsed.data.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    let slug = baseSlug;
    let attempt = 0;
    while (await prisma.tenant.findUnique({ where: { slug } })) {
      attempt++;
      slug = `${baseSlug}-${attempt}`;
    }

    // Transaction : créer Tenant + upgrader User en OWNER
    const { tenant } = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          ...parsed.data,
          slug,
          status: "PENDING", // validation admin requise
          users: {
            connect: { id: auth.userId },
          },
        },
        select: {
          id:   true,
          name: true,
          slug: true,
          plan: true,
          status: true,
        },
      });

      // Upgrader le User CLIENT → OWNER
      await tx.user.update({
        where: { id: auth.userId },
        data:  { role: "OWNER", tenantId: tenant.id },
      });

      // AuditLog
      await tx.auditLog.create({
        data: {
          action:   "tenant.created",
          entity:   "Tenant",
          entityId: tenant.id,
          actorId:  auth.userId,
          newValue: { name: tenant.name, slug: tenant.slug },
        },
      });

      return { tenant };
    });

    return NextResponse.json({ data: tenant }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}


// ============================================================
// app/api/tenants/[id]/route.ts
// GET   → profil public
// PATCH → mise à jour (gérant ou admin)
// ============================================================

async function GET_ONE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { id: params.id },
          { slug: params.id }, // accepter id ou slug
        ],
        status: "ACTIVE",
      },
      select: {
        id:             true,
        name:           true,
        slug:           true,
        phone:          true,
        whatsapp:       true,
        email:          true,
        address:        true,
        city:           true,
        country:        true,
        photos:         true,
        plan:           true,
        socials:        true,
        depositEnabled: true,
        depositPercent: true,
        services: {
          where:   { isActive: true },
          select: {
            id:          true,
            name:        true,
            category:    true,
            priceCents:  true,
            durationMin: true,
            photos:      true,
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
        _count: { select: { bookings: true } },
      },
    });

    if (!tenant) {
      return NextResponse.json(AppErrors.TENANT_NOT_FOUND().toJSON(), { status: 404 });
    }

    return NextResponse.json(
      { data: tenant },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

async function PATCH_ONE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await withAuth(req);
    const roleCheck = withRole(auth, ["OWNER", "STAFF", "ADMIN", "SUPER_ADMIN"]);
    if (!roleCheck.ok) return roleCheck.response;

    // Vérifier l'accès cross-tenant
    const tenantCheck = withTenant(auth, params.id);
    if (!tenantCheck.ok) return tenantCheck.response;

    const raw = await req.json().catch(() => null);
    if (!raw) return NextResponse.json(AppErrors.INVALID_JSON().toJSON(), { status: 400 });

    const parsed = UpdateTenantSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(zodErrorResponse(parsed.error), { status: 422 });
    }

    // Vérifier que les réseaux sociaux ne sont activés qu'en PRO+
    const tenant = await prisma.tenant.findUnique({
      where:  { id: params.id },
      select: { plan: true },
    });

    if (!tenant) return NextResponse.json(AppErrors.TENANT_NOT_FOUND().toJSON(), { status: 404 });

    const isFree = tenant.plan === "FREE";
    const { facebook, instagram, tiktok, website, depositEnabled, depositPercent, ...rest } = parsed.data;

    const updateData: Record<string, unknown> = { ...rest };

    // Réseaux sociaux = PRO+
    if (!isFree) {
      if (facebook !== undefined)  updateData.facebook  = facebook;
      if (instagram !== undefined) updateData.instagram = instagram;
      if (tiktok !== undefined)    updateData.tiktok    = tiktok;
      if (website !== undefined)   updateData.website   = website;
    }

    // Acompte = PRO+
    if (!isFree) {
      if (depositEnabled !== undefined) updateData.depositEnabled = depositEnabled;
      if (depositPercent !== undefined) updateData.depositPercent = depositPercent;
    }

    const updated = await prisma.tenant.update({
      where:  { id: params.id },
      data:   updateData as any,
      select: {
        id:          true,
        name:        true,
        slug:        true,
        plan:        true,
        updatedAt:   true,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleRouteError(err);
  }
}

export function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(req) });
}
