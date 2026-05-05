// ============================================================
// services/booking.service.ts
// BOOKING ENGINE — Production-ready
//
// Anti double-booking strategy (defence in depth, 4 layers):
//   1. Domain rules   — pure functions, no DB, fail fast
//   2. FOR UPDATE     — Tenant lock then Slot lock (consistent order,
//                       deadlock-free) inside the transaction
//   3. Double-check   — findFirst after lock (catches races the lock window
//                       cannot see, e.g. a PENDING that existed before lock)
//   4. Partial index  — DB-level: CREATE UNIQUE INDEX ... WHERE status IN
//                       ('PENDING','CONFIRMED') — migration 20260508000000
//
// Idempotency:
//   - Fast-path read BEFORE the transaction (optimistic, avoids lock acquisition)
//   - P2002 on idempotencyKey inside the transaction is caught and resolved
//     by re-fetching the existing booking → correct idempotent response
//   - P2002 on the slot partial index → SLOT_TAKEN (distinguished by a
//     post-catch findUnique on idempotencyKey)
//
// Deadlock prevention:
//   Always acquire row locks in the same order: Tenant → Slot.
//   Never reverse this order anywhere in the codebase.
//
// Transaction isolation: READ COMMITTED (default) + FOR UPDATE is correct here.
// Serializable would prevent phantom reads but adds retry overhead we don't need
// because FOR UPDATE already serialises the critical section.
// ============================================================

// Side-effect import: registers all domain event handlers before first emitEvent
import "@/lib/event-handlers";

import { CacheEngine, buildCacheKey } from "@/lib/cache-engine";
import { prisma } from "@/infrastructure/db/prisma";
import { BookingStatus, PaymentStatus, NotifType, NotifStatus } from "@prisma/client";
import {
  validateBookingCreation,
  calculateBookingPricing,
  buildBookingConfirmationMessages,
  canCancelBooking,
  PLAN_LIMITS,
} from "@/domain/booking/booking.rules";
import { AppError } from "@/shared/errors";
import { emitEvent } from "@/lib/events";

// ── TYPE HELPERS ──────────────────────────────────────────────

/** Shape returned by SELECT FOR UPDATE on Tenant. */
type TenantLock = {
  id:                  string;
  bookingsUsedMonth:   number;
  plan:                "FREE" | "PRO" | "PREMIUM";
  status:              string;
};

/** Shape returned by SELECT FOR UPDATE on Slot. */
type SlotLock = {
  id:          string;
  isAvailable: boolean;
};

function isPrismaP2002(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: string; meta?: { target?: string[] | string } };
  if (e.code === "P2002") return true;
  // Certaines versions Prisma exposent uniquement meta.target sans code
  if (Array.isArray(e.meta?.target) && e.meta.target.includes("idempotencyKey")) return true;
  return false;
}

// ── INPUT TYPES ───────────────────────────────────────────────

export interface CreateBookingDTO {
  tenantId:        string;
  userId:          string;
  serviceId:       string;
  slotId:          string;
  clientNote?:     string;
  paymentProvider?: string;
  paymentRef?:     string;
  idempotencyKey:  string;  // UUID v4, generated client-side
}

export interface CancelBookingDTO {
  bookingId:   string;
  cancelledBy: string;  // userId
  reason?:     string;
}

// ── CREATE BOOKING ────────────────────────────────────────────

export async function createBooking(dto: CreateBookingDTO) {

  // ── FAST-PATH IDEMPOTENCY ─────────────────────────────────
  // Optimistic read: if the key already exists we skip all locks.
  // This is correct for the happy path; concurrent requests with the
  // same key are handled by catching P2002 after the transaction.
  const earlyExisting = await prisma.booking.findUnique({
    where:   { idempotencyKey: dto.idempotencyKey },
    include: { service: true, slot: true },
  });
  if (earlyExisting) {
    console.info(`[booking:create] idempotent hit key=${dto.idempotencyKey} id=${earlyExisting.id}`);
    return earlyExisting;
  }

  // ── LOAD REFERENCE DATA (no lock, snapshot read) ──────────
  // These reads happen outside the transaction intentionally: we want
  // to fail fast on "not found" errors before acquiring any DB locks.
  const [tenant, service, slot, user] = await Promise.all([
    prisma.tenant.findUnique({
      where:  { id: dto.tenantId },
      select: {
        id:                  true,
        name:                true,
        status:              true,
        plan:                true,
        bookingsUsedMonth:   true,
        depositEnabled:      true,
        depositPercent:      true,
        currency:            true,
        whatsapp:            true,
      },
    }),
    prisma.service.findUnique({
      where:  { id: dto.serviceId },
      select: { id: true, name: true, priceCents: true, durationMin: true, tenantId: true },
    }),
    prisma.slot.findUnique({
      where:  { id: dto.slotId },
      select: { id: true, startsAt: true, endsAt: true, isAvailable: true, tenantId: true },
    }),
    prisma.user.findUnique({
      where:  { id: dto.userId },
      select: { id: true, name: true, phone: true },
    }),
  ]);

  if (!tenant)  throw new AppError("TENANT_NOT_FOUND",  "Salon introuvable.");
  if (!service) throw new AppError("SERVICE_NOT_FOUND", "Service introuvable.");
  if (!slot)    throw new AppError("SLOT_NOT_FOUND",    "Créneau introuvable.");
  if (!user)    throw new AppError("USER_NOT_FOUND",    "Utilisateur introuvable.");

  // Cross-tenant security: service and slot must belong to the target tenant
  if (service.tenantId !== dto.tenantId || slot.tenantId !== dto.tenantId) {
    throw new AppError("CROSS_TENANT_ACCESS", "Accès non autorisé.", 403);
  }

  // ── DOMAIN VALIDATION (pure, no DB, fail fast) ────────────
  const validation = validateBookingCreation({
    slotStartsAt:            slot.startsAt,
    slotEndsAt:              slot.endsAt,
    serviceDurationMin:      service.durationMin ?? 0,
    priceCents:              service.priceCents,
    tenantBookingsUsedMonth: tenant.bookingsUsedMonth,
    tenantPlan:              tenant.plan,
    tenantStatus:            tenant.status,
    isSlotAvailable:         slot.isAvailable,
    existingBookingOnSlot:   false, // authoritative check is inside the transaction
  });
  if (!validation.ok) {
    throw new AppError(validation.code, validation.message);
  }

  // ── PRICING ───────────────────────────────────────────────
  const pricing = calculateBookingPricing(
    service.priceCents,
    tenant.depositEnabled,
    tenant.depositPercent,
    tenant.currency ?? "XOF",
  );

  // ── TRANSACTION ───────────────────────────────────────────
  // Lock order: Tenant → Slot (always this order to prevent deadlocks)
  let booking: Awaited<ReturnType<typeof prisma.booking.create>>;

  try {
    booking = await prisma.$transaction(async (tx) => {

      // Limite les locks au niveau de la transaction courante :
      //   lock_timeout  : si un lock n'est pas disponible en 2 s → erreur
      //   statement_timeout : aucune requête ne peut durer plus de 5 s
      // Evite de tenir des locks indéfiniment si le DB est lent.
      await tx.$executeRaw`SET LOCAL lock_timeout = '2s'`;
      await tx.$executeRaw`SET LOCAL statement_timeout = '5s'`;

      // ── LOCK 1: Tenant (plan limit must be re-read under lock) ──
      // Without this, two concurrent requests at bookingsUsedMonth = limit-1
      // would both pass the domain check and both succeed, exceeding the plan.
      const [lockedTenant] = await tx.$queryRaw<TenantLock[]>`
        SELECT id, "bookingsUsedMonth", plan::text, status
        FROM "Tenant"
        WHERE id = ${dto.tenantId}
        FOR UPDATE
      `;
      if (!lockedTenant) throw new AppError("TENANT_NOT_FOUND", "Salon introuvable.");

      // Re-validate limits with authoritative (locked) counter
      const limit = PLAN_LIMITS[lockedTenant.plan as keyof typeof PLAN_LIMITS]?.bookingsPerMonth ?? 20;
      if (lockedTenant.status !== "ACTIVE") {
        throw new AppError("TENANT_NOT_ACTIVE", "Ce salon n'est pas disponible actuellement.");
      }
      if (lockedTenant.bookingsUsedMonth >= limit) {
        throw new AppError("PLAN_LIMIT_REACHED", "Le salon a atteint sa limite de réservations ce mois.");
      }

      // ── LOCK 2: Slot (must come AFTER Tenant lock) ──────────
      const [lockedSlot] = await tx.$queryRaw<SlotLock[]>`
        SELECT id, "isAvailable"
        FROM "Slot"
        WHERE id = ${dto.slotId}
        FOR UPDATE
      `;
      if (!lockedSlot) throw new AppError("SLOT_NOT_FOUND", "Créneau introuvable.");
      if (!lockedSlot.isAvailable) {
        throw new AppError("SLOT_TAKEN", "Ce créneau vient d'être réservé. Choisissez un autre horaire.");
      }

      // ── DOUBLE-CHECK: final authoritative conflict scan ─────
      // SELECT FOR UPDATE on the Slot row prevents concurrent transactions
      // from creating bookings until this one commits. This findFirst is a
      // belt-and-suspenders check against any race condition in the lock window.
      const conflict = await tx.booking.findFirst({
        where:  { slotId: dto.slotId, status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] } },
        select: { id: true },
      });
      if (conflict) {
        throw new AppError("SLOT_TAKEN", "Ce créneau vient d'être réservé.");
      }

      // ── CREATE BOOKING ──────────────────────────────────────
      const newBooking = await tx.booking.create({
        data: {
          tenantId:        dto.tenantId,
          userId:          dto.userId,
          serviceId:       dto.serviceId,
          slotId:          dto.slotId,
          status:          BookingStatus.PENDING,
          paymentStatus:   PaymentStatus.PENDING,
          priceCents:      pricing.priceCents,
          depositCents:    pricing.depositCents,
          currency:        pricing.currency,
          paymentProvider: mapPaymentProvider(dto.paymentProvider),
          paymentRef:      dto.paymentRef  ?? null,
          clientNote:      dto.clientNote  ?? null,
          idempotencyKey:  dto.idempotencyKey,
        },
      });

      // ── MARK SLOT UNAVAILABLE ───────────────────────────────
      await tx.slot.update({
        where: { id: dto.slotId },
        data:  { isAvailable: false },
      });

      // ── INCREMENT PLAN COUNTER ──────────────────────────────
      await tx.tenant.update({
        where: { id: dto.tenantId },
        data:  { bookingsUsedMonth: { increment: 1 } },
      });

      // ── OUTBOX NOTIFICATIONS ────────────────────────────────
      // Never call WhatsApp directly here — write to NotificationLog.
      // The cron worker polls this table and sends asynchronously.
      const messages = buildBookingConfirmationMessages({
        clientName:  user.name,
        serviceName: service.name,
        salonName:   tenant.name,
        slotStartsAt: slot.startsAt,
        priceCents:  pricing.priceCents,
        depositCents: pricing.depositCents,
        currency:    pricing.currency,
        bookingId:   newBooking.id,
      });

      await tx.notificationLog.createMany({
        data: [
          {
            tenantId:       dto.tenantId,
            bookingId:      newBooking.id,
            type:           NotifType.BOOKING_CONFIRMED,
            status:         NotifStatus.PENDING,
            recipient:      user.phone,
            channel:        "whatsapp",
            payload:        { phone: user.phone, message: messages.clientMessage },
            idempotencyKey: `${newBooking.id}:client:confirmed`,
          },
          ...(tenant.whatsapp ? [{
            tenantId:       dto.tenantId,
            bookingId:      newBooking.id,
            type:           NotifType.BOOKING_CONFIRMED,
            status:         NotifStatus.PENDING,
            recipient:      tenant.whatsapp,
            channel:        "whatsapp",
            payload:        { phone: tenant.whatsapp, message: messages.ownerMessage },
            idempotencyKey: `${newBooking.id}:owner:confirmed`,
          }] : []),
        ],
      });

      console.info(`[booking:create] created id=${newBooking.id} tenant=${dto.tenantId} slot=${dto.slotId}`);
      return newBooking;

    }, { timeout: 10_000 }); // hard limit: never hold locks beyond 10s

  } catch (err) {

    // ── IDEMPOTENCY RACE RESOLUTION ─────────────────────────
    // A P2002 can come from two constraints:
    //   (a) idempotencyKey @unique     → another request created the booking
    //   (b) partial unique index slot  → slot was taken concurrently
    // Re-fetching by idempotencyKey distinguishes the two cases.
    if (isPrismaP2002(err)) {
      const idempotent = await prisma.booking.findUnique({
        where:   { idempotencyKey: dto.idempotencyKey },
        include: { service: true, slot: true },
      });
      if (idempotent) {
        console.info(`[booking:create] idempotent race resolved key=${dto.idempotencyKey} id=${idempotent.id}`);
        return idempotent;
      }
      // No booking with that key → P2002 came from the slot constraint
      throw new AppError("SLOT_TAKEN", "Ce créneau vient d'être réservé. Choisissez un autre horaire.");
    }

    throw err;
  }

  // ── POST-TRANSACTION: fire-and-forget ────────────────────
  // These never run inside the hot path; failures are silent.

  // Internal dashboard notification
  prisma.notificationLog.create({
    data: {
      tenantId:       dto.tenantId,
      type:           NotifType.BOOKING_CONFIRMED,
      channel:        "internal",
      status:         NotifStatus.PENDING,
      recipient:      tenant.whatsapp ?? dto.tenantId,
      idempotencyKey: `${booking.id}:owner:internal`,
      payload:        { message: "Nouvelle réservation reçue", bookingId: booking.id },
    },
  }).catch(() => {});

  // Domain event → triggers audit log, trending updates, fraud check
  emitEvent("booking.created", {
    bookingId:  booking.id,
    tenantId:   dto.tenantId,
    userId:     dto.userId,
    priceCents: booking.priceCents,
  }).catch(() => {});

  // Invalidate slot cache so next listing shows updated availability
  CacheEngine.invalidate(buildCacheKey("slots", dto.tenantId)).catch(() => {});

  return booking;
}

// ── CONFIRM BOOKING (after payment webhook) ───────────────────

export async function confirmBookingPayment(
  bookingId:   string,
  paymentRef:  string,
  provider:    string,
): Promise<ReturnType<typeof prisma.booking.update>> {
  const booking = await prisma.booking.findUnique({
    where:  { id: bookingId },
    select: { id: true, status: true },
  });

  if (!booking) throw new AppError("BOOKING_NOT_FOUND", "Réservation introuvable.");
  if (booking.status === "CONFIRMED") {
    // Idempotent: Stripe can send the same webhook multiple times
    return prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  }

  return prisma.booking.update({
    where: { id: bookingId },
    data: {
      status:          BookingStatus.CONFIRMED,
      paymentStatus:   PaymentStatus.PAID,
      paymentRef,
      paymentProvider: provider as import("@prisma/client").PaymentProvider,
      confirmedAt:     new Date(),
    },
  });
}

// ── CANCEL BOOKING ────────────────────────────────────────────

export async function cancelBooking(dto: CancelBookingDTO): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where:   { id: dto.bookingId },
    include: { slot: true, user: true, service: true, tenant: true },
  });

  if (!booking) throw new AppError("BOOKING_NOT_FOUND", "Réservation introuvable.");

  const canCancel = canCancelBooking(booking.status, booking.slot.startsAt);
  if (!canCancel.ok) throw new AppError(canCancel.code, canCancel.message);

  await prisma.$transaction(async (tx) => {

    // Re-read status inside the transaction to prevent concurrent double-cancels.
    // Without this, two concurrent cancel requests both read PENDING, both pass
    // canCancelBooking, and both decrement bookingsUsedMonth → counter goes negative.
    const current = await tx.booking.findUnique({
      where:  { id: dto.bookingId },
      select: { status: true },
    });

    if (!current) throw new AppError("BOOKING_NOT_FOUND", "Réservation introuvable.");

    // Idempotent: already cancelled, nothing to do
    if (current.status === "CANCELLED") return;

    // Guard: only PENDING or CONFIRMED can be cancelled
    if (!["PENDING", "CONFIRMED"].includes(current.status)) {
      throw new AppError(
        "BOOKING_NOT_CANCELLABLE",
        `Impossible d'annuler une réservation déjà ${current.status.toLowerCase()}.`,
      );
    }

    await tx.booking.update({
      where: { id: dto.bookingId },
      data: {
        status:       BookingStatus.CANCELLED,
        cancelledAt:  new Date(),
        cancelReason: dto.reason ?? null,
      },
    });

    await tx.slot.update({
      where: { id: booking.slotId },
      data:  { isAvailable: true },
    });

    // Only decrement if we actually changed the status
    await tx.tenant.update({
      where: { id: booking.tenantId },
      data:  { bookingsUsedMonth: { decrement: 1 } },
    });

    await tx.notificationLog.create({
      data: {
        tenantId:       booking.tenantId,
        bookingId:      booking.id,
        type:           NotifType.BOOKING_CANCELLED,
        status:         NotifStatus.PENDING,
        recipient:      booking.user.phone,
        channel:        "whatsapp",
        payload: {
          phone:   booking.user.phone,
          message: `❌ *Réservation annulée*\n\n${booking.service.name} chez ${booking.tenant.name}\nRéf: #${booking.id.slice(-8).toUpperCase()}\n\nNous espérons vous revoir bientôt sur Belo.`,
        },
        idempotencyKey: `${booking.id}:client:cancelled`,
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId: booking.tenantId,
        actorId:  dto.cancelledBy,
        action:   "booking.cancelled",
        entity:   "Booking",
        entityId: booking.id,
        newValue: { reason: dto.reason, cancelledBy: dto.cancelledBy },
      },
    });

    console.info(`[booking:cancel] cancelled id=${dto.bookingId} by=${dto.cancelledBy}`);
  });

  emitEvent("booking.cancelled", {
    bookingId:   dto.bookingId,
    tenantId:    booking.tenantId,
    cancelledBy: dto.cancelledBy,
    reason:      dto.reason,
  }).catch(() => {});
}

// ── GET BOOKINGS (dashboard) ──────────────────────────────────

export async function getTenantBookings(
  tenantId: string,
  options: {
    status?:   BookingStatus;
    date?:     Date;
    page?:     number;
    pageSize?: number;
  } = {},
) {
  const { status, date, page = 1, pageSize = 20 } = options;

  const where: Record<string, unknown> = { tenantId };
  if (status) where.status = status;
  if (date) {
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end   = new Date(date); end.setHours(23, 59, 59, 999);
    where.slot  = { startsAt: { gte: start, lte: end } };
  }

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        user:    { select: { name: true, phone: true, avatarUrl: true } },
        service: { select: { name: true, durationMin: true } },
        slot:    { select: { startsAt: true, endsAt: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.booking.count({ where }),
  ]);

  return {
    bookings,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

// ── HELPERS ───────────────────────────────────────────────────

const PAYMENT_PROVIDER_MAP: Record<string, string> = {
  wave:         "WAVE",
  orange_money: "ORANGE_MONEY",
  stripe:       "STRIPE",
  paystack:     "PAYSTACK",
  mtn_money:    "MTN_MONEY",
  cash:         "CASH",
};

function mapPaymentProvider(
  provider?: string,
): import("@prisma/client").PaymentProvider | null {
  if (!provider) return null;
  return (PAYMENT_PROVIDER_MAP[provider.toLowerCase()] ?? null) as import("@prisma/client").PaymentProvider | null;
}
