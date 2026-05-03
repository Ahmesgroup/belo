import type { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/db/prisma";

// ── IP-BASED RATE LIMIT ───────────────────────────────────────
// Used for public endpoints: bookings, slots, etc.
// NOT used for auth (auth uses rateLimitByPhone below).

export async function rateLimit(
  req: NextRequest,
  opts: { max: number; windowMs: number }
): Promise<boolean> {
  const ip  = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const key = `${ip}:${req.nextUrl.pathname}`;
  const since = new Date(Date.now() - opts.windowMs);

  const count = await prisma.auditLog.count({
    where: {
      action:   "rate.hit",
      entityId: key,
      createdAt: { gt: since },
    },
  });

  // Log this hit fire-and-forget — don't block the response
  prisma.auditLog
    .create({ data: { action: "rate.hit", entity: "RateLimit", entityId: key } })
    .catch(() => {});

  return count >= opts.max;
}

// ── PHONE-BASED RATE LIMIT ────────────────────────────────────
// Used exclusively for OTP send/verify.
// Keyed by phone number — one user cannot block another user.
// Safe behind NAT/shared IPs (offices, mobile carriers, etc.).

export async function rateLimitByPhone(
  phone: string,
  opts: { max: number; windowMs: number }
): Promise<boolean> {
  const since = new Date(Date.now() - opts.windowMs);
  const key   = `otp:${phone}`;

  const count = await prisma.auditLog.count({
    where: {
      action:    "rate.hit",
      entityId:  key,
      createdAt: { gt: since },
    },
  });

  // Always log the hit so the counter advances (fire-and-forget)
  prisma.auditLog
    .create({ data: { action: "rate.hit", entity: "OTP", entityId: key } })
    .catch(() => {});

  return count >= opts.max;
}

