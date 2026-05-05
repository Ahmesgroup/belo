// ============================================================
// lib/circuit-breaker.ts — Circuit breaker distribué via Redis
//
// États :
//   CLOSED   → < FAILURE_THRESHOLD erreurs → exécution normale
//   OPEN     → ≥ FAILURE_THRESHOLD erreurs → retourne fallback immédiat
//   HALF-OPEN → après COOLDOWN_MS, laisse passer 1 requête de test
//              succès → CLOSED (reset complet)
//              échec  → OPEN (reset timer)
//
// Erreurs métier (SLOT_TAKEN, UNAUTHORIZED, etc.) ne comptent PAS
// comme failures — seules les pannes infrastructure comptent.
//
// Dégradé : si Redis absent, le circuit breaker est transparent
// (les erreurs passent normalement, pas de fallback automatique).
// ============================================================

import { redis } from "./redis";
import type { Redis } from "@upstash/redis";

// ── TYPES ─────────────────────────────────────────────────────

export interface CircuitBreakerResult<T> {
  data:     T;
  degraded: boolean;  // true = fallback retourné (circuit ouvert)
}

// Codes d'erreur métier qui ne déclenchent PAS le circuit breaker
const BUSINESS_ERROR_CODES = new Set([
  "SLOT_TAKEN",
  "PLAN_LIMIT_REACHED",
  "TENANT_NOT_ACTIVE",
  "TENANT_NOT_FOUND",
  "NOT_FOUND",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "INVALID_DATA",
  "VALIDATION_ERROR",
  "RATE_LIMITED",
  "BOOKING_NOT_CANCELLABLE",
]);

// ── CONFIG ────────────────────────────────────────────────────

const FAILURE_THRESHOLD = 5;   // Erreurs avant ouverture
const COOLDOWN_MS       = 30_000; // 30 s avant tentative HALF-OPEN
const FAILURE_TTL_S     = 60;  // TTL Redis des compteurs

// ── CIRCUIT BREAKER ───────────────────────────────────────────

export async function withCircuitBreaker<T>(
  service:  string,
  fn:       () => Promise<T>,
  fallback: T,
): Promise<CircuitBreakerResult<T>> {

  // Capture locale pour que TypeScript puisse narrower Redis | null → Redis
  const r: Redis | null = redis;

  if (!r) {
    try {
      return { data: await fn(), degraded: false };
    } catch {
      return { data: fallback, degraded: true };
    }
  }

  const failKey     = `cb:fails:${service}`;
  const lastFailKey = `cb:lastfail:${service}`;

  const [fails, lastFail] = await Promise.all([
    r.get<number>(failKey).catch((): number | null => null),
    r.get<number>(lastFailKey).catch((): number | null => null),
  ]);

  const failCount  = fails ?? 0;
  const lastFailTs = lastFail ?? 0;
  const now        = Date.now();

  // ── OPEN ou HALF-OPEN ─────────────────────────────────────
  if (failCount >= FAILURE_THRESHOLD) {
    const elapsed   = now - lastFailTs;
    const isHalfOpen = elapsed >= COOLDOWN_MS;

    if (!isHalfOpen) {
      return { data: fallback, degraded: true };
    }

    // HALF-OPEN : une seule tentative de test
    try {
      const data = await fn();
      await Promise.all([r.del(failKey), r.del(lastFailKey)]).catch(() => {});
      return { data, degraded: false };
    } catch {
      await r.set(lastFailKey, now, { ex: FAILURE_TTL_S }).catch(() => {});
      return { data: fallback, degraded: true };
    }
  }

  // ── CLOSED : exécution normale ────────────────────────────
  try {
    const data = await fn();
    if (failCount > 0) await r.decr(failKey).catch(() => {});
    return { data, degraded: false };

  } catch (err: unknown) {
    const code = (err instanceof Error)
      ? ((err as { code?: string }).code ?? "")
      : "";

    if (BUSINESS_ERROR_CODES.has(code)) throw err;

    const pipeline = r.pipeline();
    pipeline.incr(failKey);
    pipeline.expire(failKey, FAILURE_TTL_S);
    pipeline.set(lastFailKey, now, { ex: FAILURE_TTL_S });
    await pipeline.exec().catch(() => {});

    throw err;
  }
}
