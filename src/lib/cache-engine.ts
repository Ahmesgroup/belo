// ============================================================
// lib/cache-engine.ts — Triple cache L1/L2/L3
//
// L1 : LRU in-memory    TTL ~5 s   (par instance, zéro latence)
// L2 : Redis Upstash    TTL 30–120 s (distribué entre instances)
// L3 : fetcher DB       Fallback toujours disponible
//
// Patterns :
//   • Stale-while-revalidate (SWR) — retourne stale + revalide en bg
//   • Anti-thundering herd — lock NX + jitter avant fetch L3
//   • Versioning pour read-after-write (minVersion)
//   • Background revalidation non-bloquante
// ============================================================

import { lru }   from "./lru-cache";
import { redis } from "./redis";
import type { Redis } from "@upstash/redis";

// ── TYPES ─────────────────────────────────────────────────────

interface CachePayload<T> {
  data:      T;
  version:   number;
  timestamp: number;
}

export interface CacheOptions {
  ttl:         number;  // TTL L2 en secondes
  minVersion?: number;  // Invalidation read-after-write
  l1TtlMs?:    number;  // Override TTL L1 (défaut : 5 000 ms)
}

const L1_DEFAULT_TTL_MS = 5_000;
const STALE_MULTIPLIER  = 2;
const LOCK_TTL_S        = 5;
const JITTER_MAX_MS     = 150;

// ── CACHE ENGINE ──────────────────────────────────────────────

export class CacheEngine {

  static async get<T>(
    key:     string,
    fetcher: () => Promise<{ data: T; version: number }>,
    options: CacheOptions,
  ): Promise<T> {
    const l1Ttl     = options.l1TtlMs ?? L1_DEFAULT_TTL_MS;
    const versionOk = (v: number) =>
      options.minVersion === undefined || v >= options.minVersion;

    // ── L1 ─────────────────────────────────────────────────
    const l1 = lru.get<T>(key);
    if (l1 && versionOk(l1.version)) return l1.data;

    // ── L2 ─────────────────────────────────────────────────
    // Capture local const so TypeScript can narrow Redis | null → Redis
    const r: Redis | null = redis;
    if (r) {
      const cached = await r.get<CachePayload<T>>(key).catch(() => null);

      if (cached) {
        const ageMs        = Date.now() - cached.timestamp;
        const staleLimitMs = options.ttl * STALE_MULTIPLIER * 1_000;
        const freshMs      = options.ttl * 1_000;

        if (versionOk(cached.version) && ageMs < staleLimitMs) {
          lru.set(key, cached.data, cached.version, l1Ttl);

          if (ageMs >= freshMs) {
            this.revalidateBackground(key, fetcher, options);
          }

          return cached.data;
        }
      }
    }

    // ── L3 ─────────────────────────────────────────────────
    const result = await this.fetchWithLock(key, fetcher, options);
    return result.data;
  }

  static async invalidate(key: string): Promise<void> {
    lru.delete(key);
    const r: Redis | null = redis;
    if (r) {
      await r.del(key).catch(() => {});
    }
  }

  static async invalidatePattern(pattern: string): Promise<void> {
    lru.clear();
    const r: Redis | null = redis;
    if (r) {
      const keys = await r.keys(pattern).catch(() => [] as string[]);
      if (keys.length > 0) {
        await r.del(...(keys as [string, ...string[]])).catch(() => {});
      }
    }
  }

  private static async fetchWithLock<T>(
    key:     string,
    fetcher: () => Promise<{ data: T; version: number }>,
    options: CacheOptions,
  ): Promise<CachePayload<T>> {
    const l1Ttl = options.l1TtlMs ?? L1_DEFAULT_TTL_MS;
    const r: Redis | null = redis;

    if (!r) {
      const fresh = await fetcher();
      lru.set(key, fresh.data, fresh.version, l1Ttl);
      return { ...fresh, timestamp: Date.now() };
    }

    const lockKey = `lock:${key}`;

    const gotLock = await r.set(lockKey, "1", { nx: true, ex: LOCK_TTL_S }).catch(() => null);

    if (!gotLock) {
      const wait = 50 + Math.floor(Math.random() * JITTER_MAX_MS);
      await new Promise<void>((res) => setTimeout(res, wait));

      const retry = await r.get<CachePayload<T>>(key).catch(() => null);
      if (retry) {
        lru.set(key, retry.data, retry.version, l1Ttl);
        return retry;
      }

      const fresh = await fetcher();
      lru.set(key, fresh.data, fresh.version, l1Ttl);
      return { ...fresh, timestamp: Date.now() };
    }

    try {
      const fresh   = await fetcher();
      const payload: CachePayload<T> = { ...fresh, timestamp: Date.now() };
      const exS     = options.ttl * STALE_MULTIPLIER;

      await r.set(key, payload, { ex: exS }).catch(() => {});
      lru.set(key, fresh.data, fresh.version, l1Ttl);
      return payload;
    } finally {
      // Laisser le TTL expirer — ne pas supprimer manuellement
    }
  }

  private static revalidateBackground<T>(
    key:     string,
    fetcher: () => Promise<{ data: T; version: number }>,
    options: CacheOptions,
  ): void {
    this.fetchWithLock(key, fetcher, options).catch((err: unknown) => {
      console.error(`[CacheEngine] bg revalidation failed key=${key}`, err);
    });
  }
}

// ── BUILD CACHE KEY ───────────────────────────────────────────

export function buildCacheKey(
  namespace: string,
  ...parts:  (string | number | undefined | null)[]
): string {
  const slug = parts.filter((p) => p != null).join(":");
  return `belo:${namespace}:${slug}`;
}
