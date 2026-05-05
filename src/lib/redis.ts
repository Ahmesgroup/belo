// ============================================================
// lib/redis.ts — Client Upstash Redis (L2 cache distribué)
//
// Requires in .env.local (laisser vide pour mode dégradé) :
//   UPSTASH_REDIS_REST_URL=https://...upstash.io
//   UPSTASH_REDIS_REST_TOKEN=...
//
// Mode dégradé : si les variables ne sont pas définies, redis = null.
// Tous les consommateurs vérifient isRedisAvailable() avant usage.
// Aucune erreur levée — le cache tombe silencieusement sur DB.
// ============================================================

import { Redis } from "@upstash/redis";

declare global {
  // eslint-disable-next-line no-var
  var __beloRedis: Redis | null | undefined;
}

function createRedisClient(): Redis | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Redis] UPSTASH_REDIS_REST_URL / TOKEN not set — running cache-less");
    }
    return null;
  }

  return new Redis({ url, token });
}

export const redis: Redis | null =
  globalThis.__beloRedis !== undefined
    ? globalThis.__beloRedis
    : createRedisClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__beloRedis = redis;
}

// Vérifier la connexion Redis au démarrage (dev uniquement — évite le bruit en prod)
if (process.env.NODE_ENV === "development" && redis) {
  redis.ping().then(() => {
    console.log("[Redis] Connected to Upstash ✓");
  }).catch((e: { message?: string }) => {
    console.warn("[Redis] Connection failed — cache running in DB-only mode:", e?.message);
  });
}

// Note: consumers should capture `const r = redis` locally and check
// `if (r)` for TypeScript to narrow Redis | null → Redis correctly.
// A module-level type predicate cannot narrow an imported binding.
export function isRedisAvailable(): boolean {
  return redis !== null;
}
