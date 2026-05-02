import type { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/db/prisma";

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
