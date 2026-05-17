/**
 * @frozen — Emotional Trust System
 *
 * Trust is built by what's real, not by what's loud.
 *
 * RULE : Every trust signal MUST be backend-verified before display.
 *        If the underlying data does not exist, the signal IS NOT shown.
 *        Absence > manipulation. Silence > fake urgency.
 *
 * This file defines the canonical taxonomy. Consumers (cards, drawers,
 * SEO pages) request signals via deriveTrustSignals(input) and render
 * only what was returned.
 */

import type { Market } from "@/lib/market/theme";

// ── SIGNAL TAXONOMY ──────────────────────────────────────────

export type TrustSignalKind =
  // Verification signals — verified by Belo or salon owner action
  | "salon-verified"          // Tenant.status === "ACTIVE" + manual review passed
  | "photos-real"             // Photos uploaded by salon owner (not stock)
  | "secure-payment-wave"     // Wave configured + last 30d transaction success
  | "secure-payment-stripe"   // Stripe Connect onboarded + payouts active
  // Response/quality signals — derived from real metrics
  | "fast-response"           // Average confirmation < 30 min over 14d window
  | "high-rating"             // ratingAvg >= 4.5 AND reviewCount >= 5
  | "salon-confirms"          // confirmationRate >= 90% over 30d
  // Real-time supply signals — backend-driven only
  | "booked-today"            // Today's booking count > 0 (real number)
  | "last-availability"       // remainingSlots === 1 for selected day
  // Marketplace freshness — only show when truthful
  | "new-salon";              // Tenant.createdAt < 30 days ago, status ACTIVE

// ── COPY PER MARKET ──────────────────────────────────────────
// Africa: more direct human warmth
// Europe: calmer editorial tone

interface SignalCopy {
  fr:      { africa: string; europe: string };
  en:      { africa: string; europe: string };
}

export const TRUST_COPY: Record<TrustSignalKind, SignalCopy> = {
  "salon-verified": {
    fr: { africa: "Salon vérifié",         europe: "Salon vérifié"   },
    en: { africa: "Verified salon",        europe: "Verified salon"  },
  },
  "photos-real": {
    fr: { africa: "Photos réelles",        europe: "Photos réelles"  },
    en: { africa: "Real photos",           europe: "Real photos"     },
  },
  "secure-payment-wave": {
    fr: { africa: "Paiement sécurisé Wave",      europe: "Paiement sécurisé"     },
    en: { africa: "Secure Wave payment",         europe: "Secure payment"        },
  },
  "secure-payment-stripe": {
    fr: { africa: "Paiement sécurisé Stripe",    europe: "Paiement sécurisé"     },
    en: { africa: "Secure Stripe payment",       europe: "Secure payment"        },
  },
  "fast-response": {
    fr: { africa: "Réponse WhatsApp en quelques minutes", europe: "Réponse rapide" },
    en: { africa: "WhatsApp reply in minutes",            europe: "Quick response" },
  },
  "high-rating": {
    fr: { africa: "Très bien noté",        europe: "Apprécié"      },
    en: { africa: "Highly rated",          europe: "Loved"         },
  },
  "salon-confirms": {
    fr: { africa: "Confirmé par le salon", europe: "Confirmé par le salon" },
    en: { africa: "Confirmed by salon",    europe: "Confirmed by salon"    },
  },
  "booked-today": {
    fr: { africa: "Réservé aujourd'hui",   europe: "Réservé aujourd'hui"   },
    en: { africa: "Booked today",          europe: "Booked today"          },
  },
  "last-availability": {
    fr: { africa: "Dernière disponibilité réelle", europe: "Dernière disponibilité" },
    en: { africa: "Last real opening",             europe: "Last opening"           },
  },
  "new-salon": {
    fr: { africa: "Nouveau salon sur Belo", europe: "Nouveau sur Belo"      },
    en: { africa: "New on Belo",            europe: "New on Belo"           },
  },
};

// ── DERIVATION ───────────────────────────────────────────────
// Strict — never returns a signal whose underlying data is absent.

export interface TrustInput {
  /** Tenant.status === "ACTIVE" + manual approval flag */
  isVerified?:           boolean;
  /** Salon-owned photo count > 0 (excludes stock fallback) */
  realPhotoCount?:       number;
  /** Wave payment configured AND last 30d had ≥ 1 success */
  waveActive?:           boolean;
  /** Stripe Connect onboarded AND payouts enabled */
  stripeActive?:         boolean;
  /** Mean confirmation latency in minutes over last 14 days */
  avgConfirmMinutes?:    number;
  /** TenantMetrics.ratingAvg */
  ratingAvg?:            number;
  /** Number of reviews — minimum 5 to qualify */
  reviewCount?:          number;
  /** TenantMetrics.confirmationRate (0..1) over last 30d */
  confirmationRate?:     number;
  /** Bookings created today, real count from DB */
  bookingsToday?:        number;
  /** Remaining slots for currently-selected day */
  remainingSlots?:       number;
  /** Days since tenant.createdAt */
  daysSinceCreation?:    number;
}

export interface TrustSignal {
  kind:  TrustSignalKind;
  label: string;
}

/**
 * Pure function — derives the trust signals to display from real backend data.
 * Returns at most 2-3 signals (visual restraint = signal strength).
 * Never invents data. If a field is undefined, the corresponding signal is not returned.
 */
export function deriveTrustSignals(
  input:  TrustInput,
  lang:   "fr" | "en",
  market: Market,
  max:    number = 3,
): TrustSignal[] {
  const candidates: TrustSignalKind[] = [];

  if (input.isVerified === true) {
    candidates.push("salon-verified");
  }
  if (typeof input.realPhotoCount === "number" && input.realPhotoCount > 0) {
    candidates.push("photos-real");
  }
  if (input.waveActive === true) {
    candidates.push("secure-payment-wave");
  } else if (input.stripeActive === true) {
    candidates.push("secure-payment-stripe");
  }
  if (typeof input.avgConfirmMinutes === "number" && input.avgConfirmMinutes < 30) {
    candidates.push("fast-response");
  }
  if (
    typeof input.ratingAvg === "number" &&
    typeof input.reviewCount === "number" &&
    input.ratingAvg >= 4.5 &&
    input.reviewCount >= 5
  ) {
    candidates.push("high-rating");
  }
  if (typeof input.confirmationRate === "number" && input.confirmationRate >= 0.9) {
    candidates.push("salon-confirms");
  }
  if (typeof input.bookingsToday === "number" && input.bookingsToday > 0) {
    candidates.push("booked-today");
  }
  if (input.remainingSlots === 1) {
    candidates.push("last-availability");
  }
  if (typeof input.daysSinceCreation === "number" && input.daysSinceCreation < 30) {
    candidates.push("new-salon");
  }

  // Visual restraint — at most `max` signals
  return candidates.slice(0, max).map(kind => ({
    kind,
    label: TRUST_COPY[kind][lang][market],
  }));
}
