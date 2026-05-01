// ============================================================
// domain/booking/booking.rules.ts
// LOGIQUE MÉTIER PURE — zéro import DB, zéro import API
// Fonctions testables unitairement sans aucun mock
// ============================================================

import type { Slot, Service, Tenant, Booking } from "@prisma/client";

// ── TYPES LOCAUX ──────────────────────────────────────────────

export type BookingValidationResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

export interface CreateBookingInput {
  slotStartsAt: Date;
  slotEndsAt: Date;
  serviceDurationMin: number;
  priceCents: number;
  tenantBookingsUsedMonth: number;
  tenantPlan: "FREE" | "PRO" | "PREMIUM";
  tenantStatus: string;
  isSlotAvailable: boolean;
  existingBookingOnSlot: boolean;
}

// ── LIMITES PAR PLAN ──────────────────────────────────────────
// Centralisé ici — jamais dupliqué ailleurs
// Modifier les limites ici = appliqué partout

export const PLAN_LIMITS = {
  FREE:    { bookingsPerMonth: 50,    maxServices: 3,  maxPhotos: 3 },
  PRO:     { bookingsPerMonth: 500,   maxServices: 20, maxPhotos: 10 },
  PREMIUM: { bookingsPerMonth: 99999, maxServices: 999, maxPhotos: 50 },
} as const;

// ── RÈGLE 1 : Vérifier que le tenant peut recevoir des bookings ──

export function canTenantReceiveBookings(
  tenantStatus: string,
  tenantPlan: keyof typeof PLAN_LIMITS,
  bookingsUsedMonth: number
): BookingValidationResult {
  if (tenantStatus !== "ACTIVE") {
    return {
      ok: false,
      code: "TENANT_NOT_ACTIVE",
      message: "Ce salon n'est pas disponible actuellement.",
    };
  }

  const limit = PLAN_LIMITS[tenantPlan].bookingsPerMonth;
  if (bookingsUsedMonth >= limit) {
    return {
      ok: false,
      code: "PLAN_LIMIT_REACHED",
      message: "Le salon a atteint sa limite de réservations ce mois.",
    };
  }

  return { ok: true };
}

// ── RÈGLE 2 : Vérifier que le créneau est valide ──────────────

export function isSlotBookable(
  slot: { startsAt: Date; endsAt: Date; isAvailable: boolean },
  now: Date = new Date()
): BookingValidationResult {
  if (!slot.isAvailable) {
    return {
      ok: false,
      code: "SLOT_NOT_AVAILABLE",
      message: "Ce créneau n'est plus disponible.",
    };
  }

  // Le créneau doit être dans le futur (min 15 min d'avance)
  const minAdvanceMs = 15 * 60 * 1000;
  if (slot.startsAt.getTime() - now.getTime() < minAdvanceMs) {
    return {
      ok: false,
      code: "SLOT_TOO_SOON",
      message: "Le créneau est trop proche. Réservez au moins 15 minutes à l'avance.",
    };
  }

  // Cohérence horaire
  if (slot.endsAt <= slot.startsAt) {
    return {
      ok: false,
      code: "SLOT_INVALID_TIMES",
      message: "Créneau invalide.",
    };
  }

  return { ok: true };
}

// ── RÈGLE 3 : Anti double-booking (vérif domain avant DB) ─────

export function detectDoubleBooking(
  existingActiveBookingOnSlot: boolean
): BookingValidationResult {
  if (existingActiveBookingOnSlot) {
    return {
      ok: false,
      code: "SLOT_TAKEN",
      message: "Ce créneau vient d'être réservé par quelqu'un d'autre. Choisissez un autre horaire.",
    };
  }
  return { ok: true };
}

// ── RÈGLE 4 : Calcul du prix avec acompte ─────────────────────

export interface PricingResult {
  priceCents: number;
  depositCents: number;
  balanceCents: number;
  currency: string;
}

export function calculateBookingPricing(
  priceCents: number,
  depositEnabled: boolean,
  depositPercent: number,  // 0-100
  currency: string = "XOF"
): PricingResult {
  // Toujours travailler en centimes entiers (jamais Float)
  const depositCents = depositEnabled
    ? Math.round((priceCents * depositPercent) / 100)
    : 0;

  return {
    priceCents,
    depositCents,
    balanceCents: priceCents - depositCents,
    currency,
  };
}

// ── RÈGLE 5 : Validation complète avant création ──────────────

export function validateBookingCreation(
  input: CreateBookingInput
): BookingValidationResult {
  // 1. Tenant actif
  const tenantCheck = canTenantReceiveBookings(
    input.tenantStatus,
    input.tenantPlan,
    input.tenantBookingsUsedMonth
  );
  if (!tenantCheck.ok) return tenantCheck;

  // 2. Slot valide
  const slotCheck = isSlotBookable({
    startsAt: input.slotStartsAt,
    endsAt: input.slotEndsAt,
    isAvailable: input.isSlotAvailable,
  });
  if (!slotCheck.ok) return slotCheck;

  // 3. Pas de double booking
  const doubleCheck = detectDoubleBooking(input.existingBookingOnSlot);
  if (!doubleCheck.ok) return doubleCheck;

  // 4. Prix cohérent (jamais négatif ou zéro)
  if (input.priceCents <= 0) {
    return {
      ok: false,
      code: "INVALID_PRICE",
      message: "Le prix du service est invalide.",
    };
  }

  return { ok: true };
}

// ── RÈGLE 6 : Peut-on annuler ? ───────────────────────────────

export function canCancelBooking(
  bookingStatus: string,
  slotStartsAt: Date,
  now: Date = new Date()
): BookingValidationResult {
  const nonCancellableStatuses = ["COMPLETED", "CANCELLED", "NO_SHOW"];
  if (nonCancellableStatuses.includes(bookingStatus)) {
    return {
      ok: false,
      code: "BOOKING_NOT_CANCELLABLE",
      message: "Cette réservation ne peut plus être annulée.",
    };
  }

  // Annulation gratuite jusqu'à 2h avant
  const twoHoursMs = 2 * 60 * 60 * 1000;
  const timeUntilSlot = slotStartsAt.getTime() - now.getTime();

  if (timeUntilSlot < twoHoursMs) {
    return {
      ok: false,
      code: "CANCELLATION_TOO_LATE",
      message: "L'annulation gratuite n'est plus possible (moins de 2h avant le rendez-vous).",
    };
  }

  return { ok: true };
}

// ── RÈGLE 7 : Construire le message WhatsApp ───────────────────

export interface WhatsAppBookingMessage {
  clientMessage: string;
  ownerMessage: string;
}

export function buildBookingConfirmationMessages(params: {
  clientName: string;
  serviceName: string;
  salonName: string;
  slotStartsAt: Date;
  priceCents: number;
  depositCents: number;
  currency: string;
  bookingId: string;
}): WhatsAppBookingMessage {
  const {
    clientName,
    serviceName,
    salonName,
    slotStartsAt,
    priceCents,
    depositCents,
    currency,
    bookingId,
  } = params;

  const date = slotStartsAt.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const time = slotStartsAt.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const formatAmount = (cents: number) =>
    `${(cents).toLocaleString("fr-FR")} ${currency}`;

  const clientMessage = [
    `✅ *Réservation confirmée — ${salonName}*`,
    ``,
    `📋 *Service :* ${serviceName}`,
    `📅 *Date :* ${date} à ${time}`,
    `💰 *Prix total :* ${formatAmount(priceCents)}`,
    depositCents > 0
      ? `💳 *Acompte réglé :* ${formatAmount(depositCents)}`
      : null,
    depositCents > 0
      ? `🏠 *À régler en salon :* ${formatAmount(priceCents - depositCents)}`
      : null,
    ``,
    `📌 *Réf :* #${bookingId.slice(-8).toUpperCase()}`,
    ``,
    `_Annulation gratuite jusqu'à 2h avant. Répondez à ce message pour toute question._`,
  ]
    .filter(Boolean)
    .join("\n");

  const ownerMessage = [
    `🔔 *Nouvelle réservation*`,
    ``,
    `👤 *Client :* ${clientName}`,
    `💅 *Service :* ${serviceName}`,
    `📅 *Le :* ${date} à ${time}`,
    `💰 *Montant :* ${formatAmount(priceCents)}`,
    depositCents > 0
      ? `✅ *Acompte reçu :* ${formatAmount(depositCents)}`
      : null,
    ``,
    `📌 *Réf :* #${bookingId.slice(-8).toUpperCase()}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { clientMessage, ownerMessage };
}
