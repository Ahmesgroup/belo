// ============================================================
// services/booking.service.ts
// ORCHESTRATION COMPLÈTE — le seul endroit "intelligent"
//
// Flow :
//  1. Validation domain (règles pures)
//  2. DB transaction avec FOR UPDATE LOCK (anti double-booking)
//  3. INSERT Booking
//  4. INSERT NotificationLog (outbox)
//  5. UPDATE Slot (isAvailable = false)
//  6. UPDATE Tenant (bookingsUsedMonth++)
//  7. RETURN résultat
//
// Jamais de WhatsApp direct ici → toujours via outbox
// ============================================================

// Side-effect import: registers all event handlers before any emitEvent call
import "@/lib/event-handlers";

import { prisma } from "@/infrastructure/db/prisma";
import { BookingStatus, PaymentStatus, NotifType, NotifStatus } from "@prisma/client";
import {
  validateBookingCreation,
  calculateBookingPricing,
  buildBookingConfirmationMessages,
  canCancelBooking,
} from "@/domain/booking/booking.rules";
import { generateIdempotencyKey } from "@/infrastructure/queue/worker";
import { AppError } from "@/shared/errors";
import { emitEvent } from "@/lib/events";

// ── INPUT TYPES ───────────────────────────────────────────────

export interface CreateBookingDTO {
  tenantId: string;
  userId: string;
  serviceId: string;
  slotId: string;
  clientNote?: string;
  paymentProvider?: string;
  paymentRef?: string;
  idempotencyKey: string;  // généré côté client (uuid v4)
}

export interface CancelBookingDTO {
  bookingId: string;
  cancelledBy: string;  // userId
  reason?: string;
}

// ── CREATE BOOKING ─────────────────────────────────────────────

export async function createBooking(dto: CreateBookingDTO) {

  // ── ÉTAPE 0 : IDEMPOTENCY CHECK ────────────────────────────
  // Si la même clé existe déjà → retourner le booking existant
  // Protège contre les double-clics et les retry réseau
  const existing = await prisma.booking.findUnique({
    where: { idempotencyKey: dto.idempotencyKey },
    include: { service: true, slot: true },
  });
  if (existing) return existing;

  // ── ÉTAPE 1 : CHARGER LES DONNÉES NÉCESSAIRES ─────────────
  const [tenant, service, slot] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: dto.tenantId },
      select: {
        id: true,
        name: true,
        status: true,
        plan: true,
        bookingsUsedMonth: true,
        depositEnabled: true,
        depositPercent: true,
        currency: true,
        whatsapp: true,
      },
    }),
    prisma.service.findUnique({
      where: { id: dto.serviceId },
      select: { id: true, name: true, priceCents: true, tenantId: true },
    }),
    prisma.slot.findUnique({
      where: { id: dto.slotId },
      select: { id: true, startsAt: true, endsAt: true, isAvailable: true, tenantId: true },
    }),
  ]);

  if (!tenant) throw new AppError("TENANT_NOT_FOUND", "Salon introuvable.");
  if (!service) throw new AppError("SERVICE_NOT_FOUND", "Service introuvable.");
  if (!slot) throw new AppError("SLOT_NOT_FOUND", "Créneau introuvable.");

  // Sécurité : service et slot appartiennent bien au tenant
  if (service.tenantId !== dto.tenantId || slot.tenantId !== dto.tenantId) {
    throw new AppError("CROSS_TENANT_ACCESS", "Accès non autorisé.");
  }

  // Vérifier s'il y a déjà un booking actif sur ce slot
  const existingActiveBooking = await prisma.booking.findFirst({
    where: {
      slotId: dto.slotId,
      status: { in: ["PENDING", "CONFIRMED"] },
    },
  });

  // ── ÉTAPE 2 : VALIDATION DOMAIN (rules pures) ─────────────
  const validation = validateBookingCreation({
    slotStartsAt: slot.startsAt,
    slotEndsAt: slot.endsAt,
    serviceDurationMin: 0, // passé via service si besoin
    priceCents: service.priceCents,
    tenantBookingsUsedMonth: tenant.bookingsUsedMonth,
    tenantPlan: tenant.plan,
    tenantStatus: tenant.status,
    isSlotAvailable: slot.isAvailable,
    existingBookingOnSlot: !!existingActiveBooking,
  });

  if (!validation.ok) {
    throw new AppError(validation.code, validation.message);
  }

  // ── ÉTAPE 3 : CALCUL PRIX ─────────────────────────────────
  const pricing = calculateBookingPricing(
    service.priceCents,
    tenant.depositEnabled,
    tenant.depositPercent,
    tenant.currency
  );

  // Charger les infos client pour les messages
  const user = await prisma.user.findUnique({
    where: { id: dto.userId },
    select: { id: true, name: true, phone: true },
  });
  if (!user) throw new AppError("USER_NOT_FOUND", "Utilisateur introuvable.");

  // ── ÉTAPE 4 : TRANSACTION DB ───────────────────────────────
  // Tout ou rien — si une étape échoue, rollback complet
  const booking = await prisma.$transaction(async (tx) => {

    // 4a. LOCK le slot avec SELECT FOR UPDATE
    // Empêche 2 transactions concurrentes de réserver le même slot
    const lockedSlot = await tx.$queryRaw<Array<{ id: string; isAvailable: boolean }>>`
      SELECT id, "isAvailable"
      FROM "Slot"
      WHERE id = ${dto.slotId}
      FOR UPDATE
    `;

    if (!lockedSlot[0] || !lockedSlot[0].isAvailable) {
      throw new AppError("SLOT_TAKEN", "Ce créneau vient d'être pris. Choisissez un autre horaire.");
    }

    // 4b. Vérification finale double-booking dans la transaction
    const doubleCheck = await tx.booking.findFirst({
      where: {
        slotId: dto.slotId,
        status: { in: ["PENDING", "CONFIRMED"] },
      },
    });
    if (doubleCheck) {
      throw new AppError("SLOT_TAKEN", "Ce créneau vient d'être pris.");
    }

    // 4c. Créer le booking
    const newBooking = await tx.booking.create({
      data: {
        tenantId: dto.tenantId,
        userId: dto.userId,
        serviceId: dto.serviceId,
        slotId: dto.slotId,
        status: BookingStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        priceCents: pricing.priceCents,
        depositCents: pricing.depositCents,
        currency: pricing.currency,
        paymentProvider: mapPaymentProvider(dto.paymentProvider),
        paymentRef: dto.paymentRef ?? null,
        clientNote: dto.clientNote ?? null,
        idempotencyKey: dto.idempotencyKey,
      },
    });

    // 4d. Marquer le slot comme non disponible
    await tx.slot.update({
      where: { id: dto.slotId },
      data: { isAvailable: false },
    });

    // 4e. Incrémenter le compteur mensuel du tenant
    await tx.tenant.update({
      where: { id: dto.tenantId },
      data: { bookingsUsedMonth: { increment: 1 } },
    });

    // 4f. OUTBOX — notification client
    const messages = buildBookingConfirmationMessages({
      clientName: user.name,
      serviceName: service.name,
      salonName: tenant.name,
      slotStartsAt: slot.startsAt,
      priceCents: pricing.priceCents,
      depositCents: pricing.depositCents,
      currency: pricing.currency,
      bookingId: newBooking.id,
    });

    await tx.notificationLog.createMany({
      data: [
        // Notif client
        {
          tenantId: dto.tenantId,
          bookingId: newBooking.id,
          type: NotifType.BOOKING_CONFIRMED,
          status: NotifStatus.PENDING,
          recipient: user.phone,
          channel: "whatsapp",
          payload: {
            phone: user.phone,
            message: messages.clientMessage,
          },
          idempotencyKey: `${newBooking.id}:client:confirmed`,
        },
        // Notif gérant (si numéro WhatsApp configuré)
        ...(tenant.whatsapp
          ? [
              {
                tenantId: dto.tenantId,
                bookingId: newBooking.id,
                type: NotifType.BOOKING_CONFIRMED,
                status: NotifStatus.PENDING,
                recipient: tenant.whatsapp,
                channel: "whatsapp",
                payload: {
                  phone: tenant.whatsapp,
                  message: messages.ownerMessage,
                },
                idempotencyKey: `${newBooking.id}:owner:confirmed`,
              },
            ]
          : []),
      ],
    });

    return newBooking;
  });

  // Internal notification for the dashboard (non-blocking)
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

  // Emit event — triggers audit log and any future reactions (non-blocking)
  emitEvent("booking.created", {
    bookingId:  booking.id,
    tenantId:   dto.tenantId,
    userId:     dto.userId,
    priceCents: booking.priceCents,
  }).catch(() => {});

  return booking;
}

// ── CONFIRM BOOKING (après paiement reçu) ─────────────────────

export async function confirmBookingPayment(
  bookingId: string,
  paymentRef: string,
  provider: string
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, status: true, tenantId: true, userId: true, serviceId: true, slotId: true },
  });

  if (!booking) throw new AppError("BOOKING_NOT_FOUND", "Réservation introuvable.");
  if (booking.status === "CONFIRMED") return booking; // idempotent

  return await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: BookingStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PAID,
      paymentRef,
      paymentProvider: provider as any,
      confirmedAt: new Date(),
    },
  });
}

// ── CANCEL BOOKING ────────────────────────────────────────────

export async function cancelBooking(dto: CancelBookingDTO) {
  const booking = await prisma.booking.findUnique({
    where: { id: dto.bookingId },
    include: { slot: true, user: true, service: true, tenant: true },
  });

  if (!booking) throw new AppError("BOOKING_NOT_FOUND", "Réservation introuvable.");

  // Validation domain
  const canCancel = canCancelBooking(booking.status, booking.slot.startsAt);
  if (!canCancel.ok) {
    throw new AppError(canCancel.code, canCancel.message);
  }

  await prisma.$transaction(async (tx) => {
    // Annuler le booking
    await tx.booking.update({
      where: { id: dto.bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: dto.reason ?? null,
      },
    });

    // Libérer le slot
    await tx.slot.update({
      where: { id: booking.slotId },
      data: { isAvailable: true },
    });

    // Décrémenter le compteur tenant
    await tx.tenant.update({
      where: { id: booking.tenantId },
      data: { bookingsUsedMonth: { decrement: 1 } },
    });

    // Notification d'annulation
    await tx.notificationLog.create({
      data: {
        tenantId: booking.tenantId,
        bookingId: booking.id,
        type: NotifType.BOOKING_CANCELLED,
        status: NotifStatus.PENDING,
        recipient: booking.user.phone,
        channel: "whatsapp",
        payload: {
          phone: booking.user.phone,
          message: `❌ *Réservation annulée*\n\n${booking.service.name} chez ${booking.tenant.name}\nRéf: #${booking.id.slice(-8).toUpperCase()}\n\nNous espérons vous revoir bientôt sur Belo.`,
        },
        idempotencyKey: `${booking.id}:client:cancelled`,
      },
    });

    // Audit log (kept in transaction for consistency)
    await tx.auditLog.create({
      data: {
        tenantId: booking.tenantId,
        actorId: dto.cancelledBy,
        action: "booking.cancelled",
        entity: "Booking",
        entityId: booking.id,
        newValue: { reason: dto.reason, cancelledBy: dto.cancelledBy },
      },
    });
  });

  // Emit event AFTER transaction commits — triggers fraud check (non-blocking)
  emitEvent("booking.cancelled", {
    bookingId:   dto.bookingId,
    tenantId:    booking.tenantId,
    cancelledBy: dto.cancelledBy,
    reason:      dto.reason,
  }).catch(() => {});
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

function mapPaymentProvider(provider?: string) {
  if (!provider) return null;
  return (PAYMENT_PROVIDER_MAP[provider.toLowerCase()] ?? null) as import("@prisma/client").PaymentProvider | null;
}

// ── GET BOOKINGS PAR TENANT (dashboard gérant) ────────────────

export async function getTenantBookings(
  tenantId: string,
  options: {
    status?: BookingStatus;
    date?: Date;
    page?: number;
    pageSize?: number;
  } = {}
) {
  const { status, date, page = 1, pageSize = 20 } = options;

  const where: Record<string, unknown> = { tenantId };

  if (status) where.status = status;

  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    where.slot = { startsAt: { gte: start, lte: end } };
  }

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        user: { select: { name: true, phone: true, avatarUrl: true } },
        service: { select: { name: true, durationMin: true } },
        slot: { select: { startsAt: true, endsAt: true } },
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
