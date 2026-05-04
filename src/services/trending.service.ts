// ============================================================
// services/trending.service.ts — Real-time trending scores
//
// TenantTrending tracks 24h activity windows.
// Score: bookings×3 + views×1 + favorites×2
//
// Called from event-handlers.ts on booking.created,
// tenant.viewed, and favorite.created events.
// ============================================================

import { prisma } from "@/infrastructure/db/prisma";

const SCORE_WEIGHTS = { bookings: 3, views: 1, favorites: 2 };

/** Increments bookings24h and recomputes the trending score. */
export async function onBookingForTrending(tenantId: string): Promise<void> {
  await upsertTrending(tenantId, { bookings24h: { increment: 1 } });
}

/** Increments views24h and recomputes the trending score. */
export async function onViewForTrending(tenantId: string): Promise<void> {
  await upsertTrending(tenantId, { views24h: { increment: 1 } });
}

/** Increments favorites24h and recomputes the trending score. */
export async function onFavoriteForTrending(tenantId: string): Promise<void> {
  await upsertTrending(tenantId, { favorites24h: { increment: 1 } });
}

async function upsertTrending(
  tenantId: string,
  increment: Record<string, { increment: number }>
): Promise<void> {
  try {
    // Upsert with increment, then recompute score in a second update
    const updated = await prisma.tenantTrending.upsert({
      where:  { tenantId },
      create: { tenantId, ...flattenIncrements(increment) },
      update: increment,
    });

    const score =
      updated.bookings24h  * SCORE_WEIGHTS.bookings  +
      updated.views24h     * SCORE_WEIGHTS.views     +
      updated.favorites24h * SCORE_WEIGHTS.favorites;

    await prisma.tenantTrending.update({
      where: { tenantId },
      data:  { score },
    });
  } catch (err) {
    console.error("[Trending] update failed:", err);
  }
}

function flattenIncrements(
  increments: Record<string, { increment: number }>
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(increments).map(([k, v]) => [k, v.increment])
  );
}

/**
 * Resets 24h counters for all tenants.
 * Called by /api/cron/trending-reset (once daily).
 */
export async function resetTrendingCounters(): Promise<{ reset: number }> {
  const { count } = await prisma.tenantTrending.updateMany({
    data: { bookings24h: 0, views24h: 0, favorites24h: 0, score: 0 },
  });
  return { reset: count };
}

/** Returns top trending tenants. */
export async function getTopTrending(limit = 10): Promise<Array<{
  tenantId: string; score: number;
}>> {
  return prisma.tenantTrending.findMany({
    where:   { score: { gt: 0 } },
    orderBy: { score: "desc" },
    take:    limit,
    select:  { tenantId: true, score: true },
  });
}
