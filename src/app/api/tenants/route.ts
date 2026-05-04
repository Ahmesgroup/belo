// ============================================================
// app/api/tenants/route.ts
// POST /api/tenants        → inscription nouveau salon (gérant)
// GET  /api/tenants        → liste des salons (public, avec filtres)
// ============================================================

import "@/lib/event-handlers";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/infrastructure/db/prisma";
import { withAuth, withRole, withTenant, signJWT } from "@/lib/route-auth";
import { zodErrorResponse } from "@/lib/zod-formatter";
import { handleRouteError, AppErrors } from "@/shared/errors";
import { rateLimit } from "@/lib/rate-limit";
import { getCorsHeaders } from "@/lib/cors";
import { emitEvent } from "@/lib/events";
import { geocodeAddress } from "@/services/geocode";
import { normalizePhone } from "@/lib/phone";

// ── SCHEMAS ───────────────────────────────────────────────────

const CreateTenantSchema = z.object({
  name: z
    .string()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(100, "Le nom est trop long"),
  phone: z
    .string()
    .min(5, "Numéro trop court")
    .regex(/^\+?[0-9\s\-().]+$/, "Numéro invalide"),
  whatsapp: z.string().optional(),
  email:    z.string().email("Email invalide").optional(),
  address:  z.string().min(3, "Adresse trop courte"),
  city:     z.string().min(2, "Ville requise"),
  country:  z.string().length(2).default("SN"),
  // description and category are intentionally absent — they do not exist
  // on the Tenant model. Spreading unknown keys into prisma.create() causes
  // a PrismaClientValidationError at runtime even though TypeScript compiles.
});

const UpdateTenantSchema = z.object({
  name:           z.string().min(2).max(100).optional(),
  phone:          z.string().min(5).regex(/^\+?[0-9\s\-().]+$/).optional(),
  whatsapp:       z.string().optional().nullable(),
  email:          z.string().email().optional().nullable(),
  address:        z.string().min(3).optional(),
  city:           z.string().min(2).optional(),
  country:        z.string().length(2).optional(),
  facebook:       z.string().url().optional().nullable(),
  instagram:      z.string().optional().nullable(),
  tiktok:         z.string().optional().nullable(),
  website:        z.string().url().optional().nullable(),
  depositEnabled: z.boolean().optional(),
  depositPercent: z.number().int().min(10).max(100).optional(),
  customDomain:   z.string().optional().nullable(),
});

const GetTenantsSchema = z.object({
  city:     z.string().optional(),
  category: z.string().optional(),
  plan:     z.enum(["FREE", "PRO", "PREMIUM"]).optional(),
  search:   z.string().max(100).optional(),
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

// ── GET /api/tenants ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = GetTenantsSchema.safeParse({
      city:     searchParams.get("city")     ?? undefined,
      category: searchParams.get("category") ?? undefined,
      plan:     searchParams.get("plan")     ?? undefined,
      search:   searchParams.get("search")   ?? undefined,
      page:     searchParams.get("page")     ?? 1,
      pageSize: searchParams.get("pageSize") ?? 20,
    });

    if (!parsed.success) {
      return NextResponse.json(zodErrorResponse(parsed.error), { status: 422 });
    }

    const { city, category, plan, search, page, pageSize } = parsed.data;

    const where = {
      status: "ACTIVE" as const,
      ...(city     ? { city:     { contains: city,   mode: "insensitive" as const } } : {}),
      ...(plan     ? { plan:     plan as "FREE" | "PRO" | "PREMIUM" }                 : {}),
      ...(category ? { services: { some: { category: category as string, isActive: true } } } : {}),
      ...(search   ? {
        OR: [
          { name:    { contains: search, mode: "insensitive" as const } },
          { address: { contains: search, mode: "insensitive" as const } },
        ],
      } : {}),
    };

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        select: {
          id: true, name: true, slug: true,
          city: true, country: true, address: true,
          photos: true, coverUrl: true, plan: true,
          _count: { select: { bookings: true } },
        },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        orderBy: [{ plan: "desc" }, { createdAt: "desc" }],
      }),
      prisma.tenant.count({ where }),
    ]);

    return NextResponse.json({
      data: {
        tenants,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
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
// Creates a new salon and atomically upgrades the user to OWNER.

export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimit(req, { max: 5, windowMs: 60 * 60 * 1000 });
    if (limited) return NextResponse.json(AppErrors.RATE_LIMITED().toJSON(), { status: 429 });

    const auth = await withAuth(req);
    if (!auth.ok) return NextResponse.json(AppErrors.UNAUTHORIZED().toJSON(), { status: 401 });

    if (auth.tenantId) {
      return NextResponse.json(
        { error: { code: "ALREADY_HAS_SALON", message: "Vous avez déjà un salon enregistré." } },
        { status: 409 },
      );
    }

    const raw = await req.json().catch(() => null);
    if (!raw) return NextResponse.json(AppErrors.INVALID_JSON().toJSON(), { status: 400 });

    const parsed = CreateTenantSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(zodErrorResponse(parsed.error), { status: 422 });
    }

    // Resolve default dial code from country for E.164 normalisation
    const COUNTRY_DIAL: Record<string, string> = {
      SN: "221", CI: "225", ML: "223", GN: "224", BF: "226",
      CM: "237", TG: "228", BJ: "229", MA: "212", DZ: "213",
      TN: "216", EG: "20",  GH: "233", NG: "234", KE: "254",
      FR: "33",  BE: "32",  LU: "352", CH: "41",  DE: "49",
      GB: "44",  US: "1",   CA: "1",
    };
    const dialDefault = COUNTRY_DIAL[parsed.data.country] ?? "221";
    const phoneE164   = normalizePhone(parsed.data.phone, dialDefault);

    // Geocode — lat/lng must never be null for ranking SQL queries
    const geo = await geocodeAddress(parsed.data.address, parsed.data.city);

    // Build unique slug
    const baseSlug = parsed.data.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    let slug    = baseSlug;
    let attempt = 0;
    while (await prisma.tenant.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${++attempt}`;
    }

    // Atomic: create Tenant + upgrade User to OWNER.
    // Only map Tenant-model columns explicitly — spreading parsed.data would
    // include description/category which don't exist on Tenant and cause a
    // PrismaClientValidationError (not caught as P2002/P2025, → silent 500).
    const { tenant } = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name:     parsed.data.name,
          slug,
          phone:    phoneE164,
          whatsapp: parsed.data.whatsapp ?? null,
          email:    parsed.data.email    ?? null,
          address:  parsed.data.address,
          city:     parsed.data.city,
          country:  parsed.data.country,
          lat:      geo.lat,
          lng:      geo.lng,
          status:   "PENDING",
          users:    { connect: { id: auth.userId } },
        },
        select: { id: true, name: true, slug: true, plan: true, status: true },
      });

      await tx.user.update({
        where: { id: auth.userId },
        data:  { role: "OWNER", tenantId: tenant.id },
      });

      await tx.auditLog.create({
        data: {
          action:   "tenant.created",
          entity:   "Tenant",
          entityId: tenant.id,
          actorId:  auth.userId,
          newValue: { name: tenant.name, slug: tenant.slug, geoSource: geo.source },
        },
      });

      return { tenant };
    });

    emitEvent("tenant.created", {
      tenantId:   tenant.id,
      tenantName: tenant.name,
      ownerId:    auth.userId,
      plan:       tenant.plan,
    }).catch(() => {});

    // Fresh JWT with new role so the client can update localStorage immediately
    const accessToken = await signJWT({
      sub:      auth.userId,
      role:     "OWNER",
      tenantId: tenant.id,
    });

    return NextResponse.json({
      data: { tenant, accessToken, user: { role: "OWNER", tenantId: tenant.id } },
    }, { status: 201 });

  } catch (err) {
    console.error("[POST /api/tenants]", err);
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
          { id:   params.id },
          { slug: params.id },
        ],
        status: "ACTIVE",
      },
      select: {
        id: true, name: true, slug: true,
        phone: true, whatsapp: true, email: true,
        address: true, city: true, country: true,
        photos: true, plan: true, socials: true,
        depositEnabled: true, depositPercent: true,
        services: {
          where:   { isActive: true },
          select:  {
            id: true, name: true, category: true,
            priceCents: true, durationMin: true, photos: true,
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
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } },
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
    const auth       = await withAuth(req);
    const roleCheck  = withRole(auth, ["OWNER", "STAFF", "ADMIN", "SUPER_ADMIN"]);
    if (!roleCheck.ok) return roleCheck.response;

    const tenantCheck = withTenant(auth, params.id);
    if (!tenantCheck.ok) return tenantCheck.response;

    const raw = await req.json().catch(() => null);
    if (!raw) return NextResponse.json(AppErrors.INVALID_JSON().toJSON(), { status: 400 });

    const parsed = UpdateTenantSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(zodErrorResponse(parsed.error), { status: 422 });
    }

    const tenant = await prisma.tenant.findUnique({
      where:  { id: params.id },
      select: { plan: true },
    });
    if (!tenant) return NextResponse.json(AppErrors.TENANT_NOT_FOUND().toJSON(), { status: 404 });

    const isFree = tenant.plan === "FREE";
    const { facebook, instagram, tiktok, website, depositEnabled, depositPercent, ...rest } = parsed.data;

    const updateData: Record<string, unknown> = { ...rest };

    if (!isFree) {
      if (facebook  !== undefined) updateData.facebook  = facebook;
      if (instagram !== undefined) updateData.instagram = instagram;
      if (tiktok    !== undefined) updateData.tiktok    = tiktok;
      if (website   !== undefined) updateData.website   = website;
      if (depositEnabled !== undefined) updateData.depositEnabled = depositEnabled;
      if (depositPercent !== undefined) updateData.depositPercent = depositPercent;
    }

    const updated = await prisma.tenant.update({
      where:  { id: params.id },
      data:   updateData as any,
      select: { id: true, name: true, slug: true, plan: true, updatedAt: true },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleRouteError(err);
  }
}

export function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(req) });
}
