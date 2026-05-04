// GET /api/cron/metrics
// Recalculates TenantMetrics for all active tenants (daily).
// Also resets TenantTrending 24h counters.

import "@/lib/event-handlers";

import { NextRequest, NextResponse } from "next/server";
import { prisma }               from "@/infrastructure/db/prisma";
import { recalculateMetrics }   from "@/services/ranking.service";
import { resetTrendingCounters } from "@/services/trending.service";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();

  try {
    const tenants = await prisma.tenant.findMany({
      where:  { status: "ACTIVE", deletedAt: null },
      select: { id: true },
    });

    // Process in batches of 20 to avoid DB overload
    const BATCH = 20;
    let processed = 0;
    for (let i = 0; i < tenants.length; i += BATCH) {
      await Promise.allSettled(
        tenants.slice(i, i + BATCH).map(t => recalculateMetrics(t.id))
      );
      processed += Math.min(BATCH, tenants.length - i);
    }

    const { reset } = await resetTrendingCounters();

    return NextResponse.json({
      ok:        true,
      processed,
      trendingReset: reset,
      duration:  `${Date.now() - start}ms`,
    });
  } catch (err) {
    console.error("[Cron/Metrics]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
