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

// ── SAFE JSON PARSE ───────────────────────────────────────────
// Centralisé ici — pas d'IIFE inline, debug possible en prod.
// Loggue la clé concernée pour faciliter le debug Vercel logs.
//
// Note: @upstash/redis may auto-deserialize JSON responses and return
// an already-parsed object even when get<string>() is called.
// The runtime guard `typeof (raw as unknown) !== "string"` handles both:
//   • Upstash returns raw string → JSON.parse is called
//   • Upstash returns parsed object → returned as-is (no double-parse)

function safeParse<T>(raw: string | null, key?: string): T | null {
  if (!raw) return null;

  // Runtime guard: Upstash REST client may auto-deserialize JSON.
  // Bypass TypeScript narrowing with `as unknown` to check actual runtime type.
  if (typeof (raw as unknown) !== "string") return raw as unknown as T;

  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error(
      `[CacheEngine] JSON parse failed${key ? ` for key "${key}"` : ""}:`,
      e,
    );
    return null;
  }
}

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
    const r: Redis | null = redis;
    if (r) {
      // FIX: get<string> + safeParse instead of get<CachePayload<T>>
      // get<T>() does not guarantee deserialization when stored as string via set(key, JSON.stringify(...))
      const raw    = await r.get<string>(key).catch((): string | null => null);
      const cached = safeParse<CachePayload<T>>(raw, key);

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
      // ⚠️ SCALE WARNING: redis.keys() est O(N) — peut bloquer Redis à > 10k clés.
      // Phase 2: remplacer par tag-based invalidation :
      //   await r.smembers(`tag:${pattern}`) → DEL chaque clé membre
      // OK pour Phase 1 (< 100 salons actifs)
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

      // FIX: get<string> + safeParse for consistent JSON handling
      const retryRaw = await r.get<string>(key).catch((): string | null => null);
      const retry    = safeParse<CachePayload<T>>(retryRaw, key);
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

      // FIX: store as explicit JSON string so get<string> + safeParse round-trips correctly.
      // Do NOT use setex() — it has the same string storage issue.
      // Do NOT add nx:false — Upstash doesn't support it; SET without NX overwrites by default.
      await r.set(key, JSON.stringify(payload), { ex: exS }).catch(() => {});

      lru.set(key, fresh.data, fresh.version, l1Ttl);
      return payload;
    } finally {
      // Leave lock TTL to expire — never delete manually
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
