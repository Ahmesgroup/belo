// ============================================================
// app/api/services/route.ts
// GET    /api/services            → liste publique d'un salon
// POST   /api/services            → créer un service (gérant)
//
// app/api/services/[id]/route.ts
// GET    /api/services/:id        → détail service
// PATCH  /api/services/:id        → modifier service (gérant)
// DELETE /api/services/:id        → supprimer service (gérant)
//
// app/api/services/[id]/photos/route.ts
// POST   /api/services/:id/photos → uploader photo (gérant)
// DELETE /api/services/:id/photos → supprimer photo (gérant)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/infrastructure/db/prisma";
import { withAuth, withRole, withTenant } from "@/middleware";
import { zodErrorResponse } from "@/lib/zod-formatter";
import { AppError } from "@/shared/errors";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/config/env";

// ── SCHEMAS ───────────────────────────────────────────────────

// Catégories autorisées (extensible)
const SERVICE_CATEGORIES = [
  "nails",
  "massage",
  "hair",
  "beauty",
  "skin",
  "makeup",
  "waxing",
  "other",
] as const;

const CreateServiceSchema = z.object({
  name: z
    .string()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(100, "Le nom est trop long (max 100 caractères)"),
  description: z
    .string()
    .max(1000, "La description est trop longue (max 1000 caractères)")
    .optional(),
  category: z.enum(SERVICE_CATEGORIES, {
    errorMap: () => ({ message: "Catégorie non reconnue" }),
  }),
  priceCents: z
    .number()
    .int("Le prix doit être un nombre entier")
    .positive("Le prix doit être supérieur à 0")
    .max(100_000_00, "Prix maximum dépassé"), // 1 000 000 FCFA max
  durationMin: z
    .number()
    .int()
    .min(15,  "Durée minimale : 15 minutes")
    .max(480, "Durée maximale : 8 heures"),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

const UpdateServiceSchema = CreateServiceSchema.partial();

const GetServicesSchema = z.object({
  tenantId:  z.string().cuid("Salon invalide"),
  category:  z.enum(SERVICE_CATEGORIES).optional(),
  isActive:  z.coerce.boolean().optional(),
  page:      z.coerce.number().int().positive().default(1),
  pageSize:  z.coerce.number().int().min(1).max(50).default(20),
});

// ── GET /api/services ─────────────────────────────────────────
// Route publique — pas besoin d'être connecté

export async function GET(req: NextRequest) {
  try {
    const limited = await rateLimit(req, { max: 60, windowMs: 60_000 });
    if (limited) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED" } },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(req.url);
    const parsed = GetServicesSchema.safeParse({
      tenantId: searchParams.get("tenantId"),
      category: searchParams.get("category") ?? undefined,
      isActive: searchParams.get("isActive") ?? undefined,
      page:     searchParams.get("page") ?? 1,
      pageSize: searchParams.get("pageSize") ?? 20,
    });

    if (!parsed.success) {
      return NextResponse.json(zodErrorResponse(parsed.error), { status: 422 });
    }

    const { tenantId, category, isActive, page, pageSize } = parsed.data;

    const where = {
      tenantId,
      ...(category !== undefined ? { category }  : {}),
      ...(isActive !== undefined ? { isActive }   : { isActive: true }),
    };

    const [services, total] = await Promise.all([
      prisma.service.findMany({
        where,
        select: {
          id:          true,
          name:        true,
          description: true,
          category:    true,
          priceCents:  true,
          durationMin: true,
          photos:      true,
          isActive:    true,
          sortOrder:   true,
          // Compter les réservations pour afficher la popularité
          _count: { select: { bookings: true } },
        },
        orderBy: [
          { sortOrder: "asc" },
          { name:      "asc" },
        ],
        skip:  (page - 1) * pageSize,
        take:  pageSize,
      }),
      prisma.service.count({ where }),
    ]);

    return NextResponse.json(
      {
        data: {
          services,
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
          },
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60",
        },
      }
    );

  } catch (err) {
    return handleError(err);
  }
}

// ── POST /api/services ────────────────────────────────────────
// Créer un service (gérant uniquement)

export async function POST(req: NextRequest) {
  try {
    const auth = await withAuth(req);
    const roleCheck = withRole(auth, ["OWNER", "STAFF", "ADMIN", "SUPER_ADMIN"]);
    if (!roleCheck.ok) return roleCheck.response;

    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) {
      return NextResponse.json(
        { error: { code: "MISSING_TENANT" } },
        { status: 400 }
      );
    }

    const raw = await req.json().catch(() => null);
    if (!raw) {
      return NextResponse.json(
        { error: { code: "INVALID_JSON" } },
        { status: 400 }
      );
    }

    const parsed = CreateServiceSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(zodErrorResponse(parsed.error), { status: 422 });
    }

    // Vérifier les limites du plan
    const tenant = await prisma.tenant.findUnique({
      where:  { id: tenantId },
      select: { plan: true },
    });
    if (!tenant) {
      return NextResponse.json(
        { error: { code: "TENANT_NOT_FOUND" } },
        { status: 404 }
      );
    }

    const PLAN_SERVICE_LIMITS = { FREE: 3, PRO: 20, PREMIUM: 999 } as const;
    const maxServices = PLAN_SERVICE_LIMITS[tenant.plan];

    const currentCount = await prisma.service.count({ where: { tenantId } });
    if (currentCount >= maxServices) {
      return NextResponse.json(
        {
          error: {
            code:    "PLAN_LIMIT_REACHED",
            message: `Votre plan ${tenant.plan} autorise ${maxServices} service(s) maximum. Passez à un plan supérieur pour en ajouter davantage.`,
          },
        },
        { status: 403 }
      );
    }

    const service = await prisma.service.create({
      data: {
        tenantId,
        ...parsed.data,
        photos: [], // photos uploadées séparément via /photos
      },
      select: {
        id:          true,
        name:        true,
        category:    true,
        priceCents:  true,
        durationMin: true,
        isActive:    true,
        createdAt:   true,
      },
    });

    return NextResponse.json({ data: service }, { status: 201 });

  } catch (err) {
    return handleError(err);
  }
}


// ============================================================
// app/api/services/[id]/route.ts
// GET / PATCH / DELETE sur un service spécifique
// ============================================================

export async function GET_ONE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const service = await prisma.service.findUnique({
      where:  { id: params.id },
      include: {
        tenant: {
          select: {
            id:      true,
            name:    true,
            city:    true,
            country: true,
            phone:   true,
            whatsapp: true,
          },
        },
        _count: { select: { bookings: true } },
      },
    });

    if (!service || !service.isActive) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Service introuvable." } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: service });

  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH_ONE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await withAuth(req);
    const roleCheck = withRole(auth, ["OWNER", "STAFF", "ADMIN", "SUPER_ADMIN"]);
    if (!roleCheck.ok) return roleCheck.response;

    // Vérifier que le service appartient au tenant du token
    const existing = await prisma.service.findUnique({
      where:  { id: params.id },
      select: { tenantId: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND" } },
        { status: 404 }
      );
    }

    const tenantCheck = withTenant(auth, existing.tenantId);
    if (!tenantCheck.ok) return tenantCheck.response;

    const raw = await req.json().catch(() => null);
    if (!raw) {
      return NextResponse.json({ error: { code: "INVALID_JSON" } }, { status: 400 });
    }

    const parsed = UpdateServiceSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(zodErrorResponse(parsed.error), { status: 422 });
    }

    const updated = await prisma.service.update({
      where: { id: params.id },
      data:  parsed.data,
      select: {
        id:          true,
        name:        true,
        category:    true,
        priceCents:  true,
        durationMin: true,
        isActive:    true,
        updatedAt:   true,
      },
    });

    return NextResponse.json({ data: updated });

  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE_ONE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await withAuth(req);
    const roleCheck = withRole(auth, ["OWNER", "ADMIN", "SUPER_ADMIN"]);
    if (!roleCheck.ok) return roleCheck.response;

    const existing = await prisma.service.findUnique({
      where:  { id: params.id },
      select: {
        tenantId: true,
        _count:   { select: { bookings: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND" } },
        { status: 404 }
      );
    }

    const tenantCheck = withTenant(auth, existing.tenantId);
    if (!tenantCheck.ok) return tenantCheck.response;

    // Ne pas supprimer si des réservations futures existent
    const futureBookings = await prisma.booking.count({
      where: {
        serviceId: params.id,
        status:    { in: ["PENDING", "CONFIRMED"] },
        slot:      { startsAt: { gt: new Date() } },
      },
    });

    if (futureBookings > 0) {
      return NextResponse.json(
        {
          error: {
            code:    "SERVICE_HAS_BOOKINGS",
            message: `Ce service a ${futureBookings} réservation(s) à venir. Désactivez-le plutôt que de le supprimer.`,
          },
        },
        { status: 409 }
      );
    }

    // Soft delete via isActive=false si le service a des bookings passés
    // Hard delete si jamais utilisé
    const pastBookings = await prisma.booking.count({
      where: { serviceId: params.id },
    });

    if (pastBookings > 0) {
      // Garder l'historique — désactiver seulement
      await prisma.service.update({
        where: { id: params.id },
        data:  { isActive: false },
      });
      return NextResponse.json({
        data: {
          deleted:  false,
          disabled: true,
          reason:   "Service désactivé (historique de réservations conservé).",
        },
      });
    }

    await prisma.service.delete({ where: { id: params.id } });
    return NextResponse.json({ data: { deleted: true } });

  } catch (err) {
    return handleError(err);
  }
}


// ============================================================
// app/api/services/[id]/photos/route.ts
// Upload et suppression de photos de service
//
// Stratégie coût stockage :
//   Phase 1 : Cloudflare R2 (10 GB gratuit)
//   Phase 1 alternative : stocker l'URL base64 dans le champ photos[]
//     (pour démo / prototype — max 5 photos × 200 KB = 1 MB/service)
//   Phase 2 : R2 avec CDN Cloudflare (latence minimale depuis Dakar)
// ============================================================

const PhotoUploadSchema = z.object({
  // Base64 de l'image (pour prototype sans R2 configuré)
  // En prod : remplacer par un pre-signed URL R2
  base64:    z.string().optional(),
  url:       z.string().url().optional(),
  filename:  z.string().max(255),
  mimeType:  z.enum(["image/jpeg", "image/png", "image/webp", "image/heic"]),
}).refine(
  (d) => d.base64 || d.url,
  "Fournir soit base64 soit une URL d'image"
);

export async function POST_PHOTO(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await withAuth(req);
    const roleCheck = withRole(auth, ["OWNER", "STAFF", "ADMIN", "SUPER_ADMIN"]);
    if (!roleCheck.ok) return roleCheck.response;

    const service = await prisma.service.findUnique({
      where:  { id: params.id },
      select: { tenantId: true, photos: true },
    });

    if (!service) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND" } },
        { status: 404 }
      );
    }

    const tenantCheck = withTenant(auth, service.tenantId);
    if (!tenantCheck.ok) return tenantCheck.response;

    // Vérifier limite photos selon plan
    const tenant = await prisma.tenant.findUnique({
      where:  { id: service.tenantId },
      select: { plan: true },
    });

    const PLAN_PHOTO_LIMITS = { FREE: 3, PRO: 10, PREMIUM: 50 } as const;
    const maxPhotos = PLAN_PHOTO_LIMITS[tenant?.plan ?? "FREE"];

    if (service.photos.length >= maxPhotos) {
      return NextResponse.json(
        {
          error: {
            code:    "PHOTO_LIMIT_REACHED",
            message: `Votre plan autorise ${maxPhotos} photo(s) par service.`,
          },
        },
        { status: 403 }
      );
    }

    const raw = await req.json().catch(() => null);
    if (!raw) return NextResponse.json({ error: { code: "INVALID_JSON" } }, { status: 400 });

    const parsed = PhotoUploadSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(zodErrorResponse(parsed.error), { status: 422 });
    }

    // Upload vers R2 si configuré, sinon stocker l'URL directement
    let photoUrl: string;

    if (parsed.data.url) {
      // URL externe déjà uploadée côté client (pre-signed URL)
      photoUrl = parsed.data.url;
    } else if (parsed.data.base64 && env.R2_BUCKET) {
      // Upload vers R2
      photoUrl = await uploadToR2({
        base64:   parsed.data.base64,
        filename: parsed.data.filename,
        mimeType: parsed.data.mimeType,
        path:     `services/${params.id}/${Date.now()}-${parsed.data.filename}`,
      });
    } else {
      // Mode prototype : stocker base64 en DB (max 200 KB)
      const sizeKB = Math.round((parsed.data.base64?.length ?? 0) * 0.75 / 1024);
      if (sizeKB > 200) {
        return NextResponse.json(
          {
            error: {
              code:    "FILE_TOO_LARGE",
              message: "Image trop grande (max 200 KB sans R2 configuré).",
            },
          },
          { status: 413 }
        );
      }
      photoUrl = `data:${parsed.data.mimeType};base64,${parsed.data.base64}`;
    }

    // Ajouter l'URL au tableau photos du service
    const updated = await prisma.service.update({
      where: { id: params.id },
      data:  { photos: { push: photoUrl } },
      select: { id: true, photos: true },
    });

    return NextResponse.json({ data: updated }, { status: 201 });

  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE_PHOTO(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await withAuth(req);
    const roleCheck = withRole(auth, ["OWNER", "STAFF", "ADMIN", "SUPER_ADMIN"]);
    if (!roleCheck.ok) return roleCheck.response;

    const { photoUrl } = await req.json().catch(() => ({}));
    if (!photoUrl) {
      return NextResponse.json(
        { error: { code: "MISSING_PARAMS", message: "photoUrl requis." } },
        { status: 400 }
      );
    }

    const service = await prisma.service.findUnique({
      where:  { id: params.id },
      select: { tenantId: true, photos: true },
    });

    if (!service) {
      return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    }

    const tenantCheck = withTenant(auth, service.tenantId);
    if (!tenantCheck.ok) return tenantCheck.response;

    // Retirer l'URL du tableau
    const updatedPhotos = service.photos.filter((p) => p !== photoUrl);

    const updated = await prisma.service.update({
      where: { id: params.id },
      data:  { photos: updatedPhotos },
      select: { id: true, photos: true },
    });

    // TODO Phase 2 : supprimer aussi le fichier sur R2

    return NextResponse.json({ data: updated });

  } catch (err) {
    return handleError(err);
  }
}

// ── UPLOAD R2 ─────────────────────────────────────────────────
// Cloudflare R2 = compatible S3 — 10 GB gratuit

async function uploadToR2(params: {
  base64:   string;
  filename: string;
  mimeType: string;
  path:     string;
}): Promise<string> {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY || !env.R2_SECRET_KEY || !env.R2_BUCKET) {
    throw new AppError("R2_NOT_CONFIGURED", "Stockage R2 non configuré.", 500);
  }

  // Décoder le base64
  const buffer = Buffer.from(params.base64, "base64");

  // Endpoint R2 compatible S3
  const url = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}/${params.path}`;

  // Signature AWS Sigv4 (R2 utilise le même protocole)
  // En prod : utiliser @aws-sdk/client-s3 ou aws4 pour la signature
  // Ici on fait un appel direct pour garder les dépendances légères
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type":   params.mimeType,
      "Content-Length": String(buffer.byteLength),
      // Headers de signature à ajouter en prod avec aws4
    },
    body: buffer,
  });

  if (!res.ok) {
    throw new AppError("R2_UPLOAD_FAILED", "Upload de l'image échoué.", 500);
  }

  // URL publique via CDN Cloudflare
  return `${env.NEXT_PUBLIC_CDN_URL}/${params.path}`;
}

// ── ERROR HANDLER ─────────────────────────────────────────────

function handleError(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return NextResponse.json(err.toJSON(), { status: err.statusCode });
  }
  console.error("[API /services]", err);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Erreur serveur." } },
    { status: 500 }
  );
}
