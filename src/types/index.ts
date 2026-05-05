/**
 * @frozen — Types métier centralisés
 * Aucun type inline dans les composants.
 * Aucun type dupliqué entre fichiers.
 */

// Re-export depuis intent.ts — seule source de vérité
export type {
  Intent,
  PositiveIntent,
  NeutralIntent,
  DangerIntent,
} from "@/lib/design/intent";

// ── ASYNC ─────────────────────────────────────────────────────

export type AsyncStatus = "idle" | "loading" | "success" | "error";

export type ErrorType = "network" | "business" | "unknown";

// ── BOOKING ───────────────────────────────────────────────────

export type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export interface Slot {
  id:          string;
  startsAt:    string;  // ISO 8601
  endsAt:      string;  // ISO 8601
  isAvailable: boolean;
}

export interface SlotsData {
  slots:          Slot[];
  total:          number;
  /** Count hint from API — used by SlotsSkeleton to prevent CLS */
  expectedCount?: number;
}

export interface Service {
  id:          string;
  name:        string;
  category:    string;
  /** Prix en unités XOF (pas de centimes — 1 unité = 1 FCFA) */
  priceCents:  number;
  durationMin: number;
  photos?:     string[];
}

export interface Salon {
  id:             string;
  name:           string;
  slug:           string;
  city:           string;
  coverUrl:       string | null;
  blurDataURL?:   string;
  rating:         number;
  reviewCount:    number;
  /**
   * Nombre de créneaux restants — vient du backend UNIQUEMENT.
   * Jamais recalculé côté UI.
   */
  remainingSlots: number;
  distanceKm:     number;
  weeklyBookings: number;
  category:       string;
  phone?:         string;
  whatsapp?:      string;
  services?:      Service[];
}

export interface Booking {
  id:           string;
  salonName:    string;
  salonSlug:    string;
  serviceName:  string;
  date:         string;  // ISO 8601
  time:         string;  // HH:mm
  status:       BookingStatus;
  priceCents:   number;
  depositCents: number;
  currency:     string;
  salonPhone?:  string;
}

// ── ERRORS ────────────────────────────────────────────────────

export interface BookingError {
  code:               string;
  message:            string;
  type:               ErrorType;
  /** Fourni quand code === "SLOT_TAKEN" — sync date + slot */
  nextAvailableSlot?: Slot;
}

// ── CACHE ─────────────────────────────────────────────────────

export interface CacheEntry {
  /**
   * undefined = jamais fetch
   * null      = erreur réseau (≠ zéro disponibilité)
   * SlotsData = succès
   */
  data?:       SlotsData | null;
  timestamp?:  number;
  /** Promise en vol — déduplique les requêtes concurrentes */
  promise?:    Promise<SlotsData>;
  /** Isolé par salonId */
  retryCount?: number;
  lastErrorAt?: number;
}
