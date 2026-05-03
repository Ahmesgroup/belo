// ============================================================
// app/api/bookings/route.ts
// API LAYER — thin layer uniquement
// Route → Service → Repo. Zéro business logic ici.
//
// POST /api/bookings  → créer une réservation
// GET  /api/bookings  → liste des réservations du tenant
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createBooking, getTenantBookings } from "@/services/booking.service";
import { withAuth, withTenant } from "@/middleware";
import { AppError } from "@/shared/errors";
import { rateLimit } from "@/lib/rate-limit";
import { prisma } from "@/infrastructure/db/prisma";
import { BookingStatus } from "@prisma/client";
import { getCorsHeaders } from "@/lib/cors";

// ── VALIDATION SCHEMA ─────────────────────────────────────────

// IDs are CUIDs from Prisma but seeded/dev data may use other formats — use min(1) not cuid()
const CreateBookingSchema = z.object({
  serviceId:       z.string().min(1, "serviceId requis"),
  slotId:          z.string().min(1, "slotId requis"),
  tenantId:        z.string().min(1).optional(),
  clientNote:      z.string().max(500).optional(),
  paymentProvider: z.enum(["wave", "orange_money", "stripe", "paystack", "mtn_money"]).default("wave"),
  paymentRef:      z.string().max(200).optional(), // external payment reference (Wave/OM transaction ID)
  idempotencyKey:  z.string().uuid("idempotencyKey doit être un UUID v4"),
});

const PatchBookingSchema = z.object({
  bookingId: z.string().min(1, "bookingId requis"),
  status:    z.enum(["CONFIRMED", "CANCELLED"]),
});

const GetBookingsSchema = z.object({
  status:   z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
  date:     z.string().datetime().optional(),
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ── POST /api/bookings ────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // 1. Rate limiting — 10 créations/min par IP
    const limited = await rateLimit(req, { max: 10, windowMs: 60_000 });
    if (limited) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Trop de requêtes. Attendez 1 minute." } },
        { status: 429 }
      );
    }

    // 2. Auth — extraire l'utilisateur depuis le JWT
    const auth = await withAuth(req);
    if (!auth.ok) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Non authentifié." } },
        { status: 401 }
      );
    }

    // 3. Parse + validation du body
    const raw = await req.json().catch(() => null);
    if (!raw) {
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Corps de la requête invalide." } },
        { status: 400 }
      );
    }

    const parsed = CreateBookingSchema.safeParse(raw);
    if (!parsed.success) {
      console.error("[API /bookings] Validation failed:", JSON.stringify({
        body: raw,
        errors: parsed.error.flatten().fieldErrors,
      }));
      return NextResponse.json(
        {
          error: {
            code:    "VALIDATION_ERROR",
            message: "Données invalides.",
            fields:  parsed.error.flatten().fieldErrors,
          },
        },
        { status: 422 }
      );
    }

    // 4. tenantId — depuis header (middleware) ou body (pass-through mode)
    const tenantId = req.headers.get("x-tenant-id") ?? parsed.data.tenantId ?? null;
    if (!tenantId) {
      return NextResponse.json(
        { error: { code: "MISSING_TENANT", message: "Contexte salon manquant." } },
        { status: 400 }
      );
    }

    // 5. Appel service — toute la logique est là-bas
    const booking = await createBooking({
      tenantId,
      userId: auth.userId,
      serviceId: parsed.data.serviceId,
      slotId: parsed.data.slotId,
      clientNote: parsed.data.clientNote,
      paymentProvider: parsed.data.paymentProvider,
      paymentRef: parsed.data.paymentRef,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    return NextResponse.json(
      {
        data: {
          id: booking.id,
          status: booking.status,
          priceCents: booking.priceCents,
          depositCents: booking.depositCents,
          currency: booking.currency,
          createdAt: booking.createdAt,
        },
      },
      { status: 201, headers: getCorsHeaders(req) }
    );

  } catch (err) {
    return handleApiError(err);
  }
}

// ── PATCH /api/bookings ───────────────────────────────────────
// Salon owner accepts (CONFIRMED) or refuses (CANCELLED) a booking

export async function PATCH(req: NextRequest) {
  try {
    const auth = await withAuth(req);
    if (!auth.ok) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Non authentifié." } },
        { status: 401 }
      );
    }

    const raw = await req.json().catch(() => null);
    if (!raw) {
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Corps de la requête invalide." } },
        { status: 400 }
      );
    }

    const parsed = PatchBookingSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Données invalides.", fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const { bookingId, status } = parsed.data;

    const booking = await prisma.booking.findUnique({
      where:  { id: bookingId },
      select: { id: true, tenantId: true, status: true, slotId: true },
    });

    if (!booking) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Réservation introuvable." } },
        { status: 404 }
      );
    }

    // Only the tenant owner (or admin) can update booking status
    if (auth.role !== "ADMIN" && auth.role !== "SUPER_ADMIN" && auth.tenantId !== booking.tenantId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Accès refusé." } },
        { status: 403 }
      );
    }

    let updated;

    if (status === "CANCELLED") {
      // Free the slot and decrement counter when owner refuses
      updated = await prisma.$transaction(async (tx) => {
        const b = await tx.booking.update({
          where: { id: bookingId },
          data:  { status: BookingStatus.CANCELLED, cancelledAt: new Date() },
        });
        await tx.slot.update({
          where: { id: booking.slotId },
          data:  { isAvailable: true },
        });
        await tx.tenant.update({
          where: { id: booking.tenantId },
          data:  { bookingsUsedMonth: { decrement: 1 } },
        });
        return b;
      });
    } else {
      updated = await prisma.booking.update({
        where: { id: bookingId },
        data:  { status: BookingStatus.CONFIRMED, confirmedAt: new Date() },
      });
    }

    return NextResponse.json(
      { data: { booking: { id: updated.id, status: updated.status } } },
      { headers: getCorsHeaders(req) }
    );

  } catch (err) {
    return handleApiError(err);
  }
}

// ── GET /api/bookings ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    // Auth
    const auth = await withAuth(req);
    if (!auth.ok) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Non authentifié." } },
        { status: 401 }
      );
    }

    // Query params
    const { searchParams } = new URL(req.url);

    // userId path — client profile history tab
    const userId = searchParams.get("userId");
    if (userId) {
      if (auth.userId !== userId && auth.role !== "ADMIN" && auth.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
      }
      const bookings = await prisma.booking.findMany({
        where: { userId },
        select: {
          id: true, status: true, createdAt: true,
          service: { select: { name: true, priceCents: true } },
          slot:    { select: { startsAt: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return NextResponse.json(
        { data: { bookings, pagination: { total: bookings.length } } },
        { headers: getCorsHeaders(req) }
      );
    }

    // Tenant — header (middleware) ou query param (client direct)
    const tenantId = req.headers.get("x-tenant-id") ?? searchParams.get("tenantId");
    if (!tenantId) {
      return NextResponse.json(
        { error: { code: "MISSING_TENANT", message: "Contexte salon manquant." } },
        { status: 400 }
      );
    }
    const parsed = GetBookingsSchema.safeParse({
      status:   searchParams.get("status") ?? undefined,
      date:     searchParams.get("date") ?? undefined,
      page:     searchParams.get("page") ?? 1,
      pageSize: searchParams.get("pageSize") ?? 20,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Paramètres invalides." } },
        { status: 422 }
      );
    }

    const result = await getTenantBookings(tenantId, {
      status:   parsed.data.status as any,
      date:     parsed.data.date ? new Date(parsed.data.date) : undefined,
      page:     parsed.data.page,
      pageSize: parsed.data.pageSize,
    });

    return NextResponse.json({ data: result }, { headers: getCorsHeaders(req) });

  } catch (err) {
    return handleApiError(err);
  }
}

export function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(req) });
}

// ── ERROR HANDLER ─────────────────────────────────────────────

function handleApiError(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return NextResponse.json(err.toJSON(), { status: err.statusCode });
  }

  // Erreur Prisma : contrainte unique violée (double booking)
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  ) {
    return NextResponse.json(
      {
        error: {
          code: "SLOT_TAKEN",
          message: "Ce créneau vient d'être réservé. Choisissez un autre horaire.",
        },
      },
      { status: 409 }
    );
  }

  console.error("[API /bookings]", err);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Erreur serveur. Réessayez." } },
    { status: 500 }
  );
}
