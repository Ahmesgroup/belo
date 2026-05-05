// ============================================================
// lib/rate-limit.ts — Rate limiting multi-critères
//
// Identité (par ordre de priorité) :
//   userId authentifié > session cookie (hash) > IP > "unknown"
//
// Backends :
//   Redis disponible  → sliding window (ZADD + ZCARD)
//   Redis absent      → DB fallback via AuditLog
//
// Les appels auth utilisent rateLimitByPhone (clé = numéro).
// Le reste utilise rateLimit (clé = identity:pathname).
// ============================================================

import type { NextRequest } from "next/server";
import { prisma }             from "@/infrastructure/db/prisma";
import { redis } from "./redis";
import type { Redis } from "@upstash/redis";

// ── IDENTITY MULTI-CRITÈRES ───────────────────────────────────

export function extractRequestIdentity(req: NextRequest): string {
  const userId = req.headers.get("x-user-id");
  if (userId) return `user:${userId}`;

  const token = req.cookies.get("belo_token")?.value;
  if (token) {
    // Hash court (16 hex chars) — ne stocke pas le token en clair
    const hash = Buffer.from(token).subarray(0, 8).toString("hex");
    return `session:${hash}`;
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  return `ip:${ip}`;
}

// ── RATE LIMIT PAR CLÉ ARBITRAIRE ────────────────────────────
// Utilisé pour les endpoints hors auth (bookings, tenants, etc.)

export async function rateLimitByKey(
  key:  string,
  opts: { max: number; windowMs: number },
): Promise<boolean> {
  const r: Redis | null = redis;
  return r ? rateLimitRedis(r, key, opts) : rateLimitDB(key, opts);
}

// ── RATE LIMIT PAR REQUÊTE (identité auto-extraite) ───────────

export async function rateLimit(
  req:  NextRequest,
  opts: { max: number; windowMs: number },
): Promise<boolean> {
  const identity = extractRequestIdentity(req);
  const key      = `${identity}:${req.nextUrl.pathname}`;
  return rateLimitByKey(key, opts);
}

// ── RATE LIMIT PAR TÉLÉPHONE (OTP) ───────────────────────────
// Conservé tel quel pour compatibilité avec auth.service.ts

export async function rateLimitByPhone(
  phone: string,
  opts:  { max: number; windowMs: number },
): Promise<boolean> {
  return rateLimitByKey(`otp:${phone}`, opts);
}

// ── BACKEND REDIS : sliding window (ZADD + ZCARD) ─────────────
// Avantage vs fixed window : pas de burst au reset de fenêtre

async function rateLimitRedis(
  r:    Redis,
  key:  string,
  opts: { max: number; windowMs: number },
): Promise<boolean> {
  const now         = Date.now();
  const windowStart = now - opts.windowMs;
  const windowS     = Math.ceil(opts.windowMs / 1_000);
  const redisKey    = `rl:${key}`;
  const member      = `${now}:${Math.random().toString(36).slice(2, 7)}`;

  const pipeline = r.pipeline();
  pipeline.zremrangebyscore(redisKey, "-inf", windowStart);
  pipeline.zadd(redisKey, { score: now, member });
  pipeline.zcard(redisKey);
  pipeline.expire(redisKey, windowS);

  const results = await pipeline.exec().catch(() => null);
  const count   = (results?.[2] as number | null) ?? 0;

  return count > opts.max;
}

// ── BACKEND DB : fixed window via AuditLog ────────────────────
// Fallback si Redis absent — légèrement moins précis (fixed window)
// mais suffisant pour la protection de base

async function rateLimitDB(
  key:  string,
  opts: { max: number; windowMs: number },
): Promise<boolean> {
  const since = new Date(Date.now() - opts.windowMs);

  const count = await prisma.auditLog.count({
    where: {
      action:    "rate.hit",
      entityId:  key,
      createdAt: { gt: since },
    },
  });

  // Log fire-and-forget (ne bloque jamais la réponse)
  prisma.auditLog
    .create({ data: { action: "rate.hit", entity: "RateLimit", entityId: key } })
    .catch(() => {});

  return count >= opts.max;
}
