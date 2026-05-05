/**
 * src/lib/cache/slotCache.ts — Cache client-side des créneaux.
 *
 * SÉMANTIQUE DU CACHE :
 *   undefined = jamais fetch (pas de requête lancée)
 *   null      = erreur réseau (≠ zéro disponibilité — ne pas confondre)
 *   SlotsData = succès (peut contenir zéro slots si aucun dispo)
 *
 * ANTI-STAMPEDE :
 *   Promise stockée → toutes les requêtes concurrentes pour le même
 *   salonId partagent la même promise (pas de double-fetch).
 *
 * RETRY ISOLÉ PAR SALON :
 *   retryCount et lastErrorAt sont isolés par salonId.
 *   Un salon en erreur ne bloque pas les autres.
 */

import type { CacheEntry, SlotsData, Slot } from "@/types";

const cache = new Map<string, CacheEntry>();

const CACHE_TTL_MS  = 60_000; // 60 s — TTL validité du cache
const MAX_RETRIES   = 3;
const RETRY_PAUSE_MS = 30_000; // 30 s pause après MAX_RETRIES

// ── HELPERS ───────────────────────────────────────────────────

function isCacheValid(entry: CacheEntry): entry is CacheEntry & { data: SlotsData; timestamp: number } {
  return (
    entry.data !== undefined &&
    entry.data !== null &&
    entry.timestamp !== undefined &&
    Date.now() - entry.timestamp < CACHE_TTL_MS
  );
}

function isRetryPaused(entry: CacheEntry): boolean {
  return (
    (entry.retryCount ?? 0) >= MAX_RETRIES &&
    entry.lastErrorAt !== undefined &&
    Date.now() - entry.lastErrorAt < RETRY_PAUSE_MS
  );
}

// ── PUBLIC API ────────────────────────────────────────────────

/**
 * Lecture synchrone du cache.
 * Retourne:
 *   undefined  → jamais chargé
 *   null       → dernière requête a échoué (erreur réseau)
 *   SlotsData  → données en cache (peut être stale)
 */
export function getSlots(salonId: string): SlotsData | null | undefined {
  const entry = cache.get(salonId);
  if (!entry) return undefined;
  if (isCacheValid(entry)) return entry.data;
  // Retourne les données stale (si disponibles) le temps de revalider
  return entry.data;
}

/**
 * Déclenche le chargement des créneaux pour un salon.
 * Idempotent : si un fetch est déjà en cours, retourne la même promise.
 * Appelé au hover/tap d'une card pour préchauffer le cache.
 */
export function preloadSlots(salonId: string): Promise<SlotsData> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("slotCache is client-only"));
  }

  const entry = cache.get(salonId);

  // Cache valide → retourner immédiatement + revalider en background
  if (entry && isCacheValid(entry)) {
    revalidateInBackground(salonId);
    return Promise.resolve(entry.data);
  }

  // Fetch en cours → déduplication
  if (entry?.promise) {
    return entry.promise;
  }

  // Retry en pause
  if (entry && isRetryPaused(entry)) {
    return Promise.reject(new Error("RETRY_PAUSED"));
  }

  // Nouvelle requête
  const promise: Promise<SlotsData> = fetchSlots(salonId)
    .then((data) => {
      cache.set(salonId, {
        data,
        timestamp:  Date.now(),
        retryCount: 0,
        promise:    undefined,
      });
      return data;
    })
    .catch((err: unknown) => {
      const current = cache.get(salonId) ?? {};
      cache.set(salonId, {
        ...current,
        data:       null,        // signale erreur réseau
        promise:    undefined,
        retryCount: (current.retryCount ?? 0) + 1,
        lastErrorAt: Date.now(),
      });
      throw err;
    });

  cache.set(salonId, { ...entry, promise });
  return promise;
}

/** Invalide le cache d'un salon (ex : après création de booking). */
export function invalidateSlots(salonId: string): void {
  cache.delete(salonId);
}

// ── INTERNAL ──────────────────────────────────────────────────

async function fetchSlots(salonId: string): Promise<SlotsData> {
  const res = await fetch(
    `/api/slots?tenantId=${encodeURIComponent(salonId)}&limit=50&available=true`,
    { signal: AbortSignal.timeout(10_000) },
  );

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = (await res.json()) as {
    data?: { slots?: Slot[]; total?: number; expectedCount?: number };
  };

  const slots = json.data?.slots ?? [];
  return {
    slots,
    total:         json.data?.total         ?? slots.length,
    expectedCount: json.data?.expectedCount ?? slots.length,
  };
}

function revalidateInBackground(salonId: string): void {
  fetchSlots(salonId)
    .then((data) => {
      cache.set(salonId, {
        data,
        timestamp:  Date.now(),
        retryCount: 0,
      });
    })
    .catch(() => {
      // Erreur silencieuse — le cache garde les données stale
    });
}
