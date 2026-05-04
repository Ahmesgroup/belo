// GET /api/admin/stream?since=ISO8601&limit=30
//
// Returns recent EventLog entries for the Mission Control live feed.
// The admin panel polls this endpoint every 5 seconds.
//
// Using polling (not SSE) because Vercel serverless functions have a
// max timeout that breaks persistent SSE connections on the free tier.
// The client uses the `since` cursor to avoid fetching duplicates.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/infrastructure/db/prisma";
import { withAuth, withRole } from "@/lib/route-auth";
import { getQueueHealth } from "@/lib/event-queue";

const QuerySchema = z.object({
  since: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  types: z.string().optional(),   // comma-separated: "fraud.detected,tenant.created"
});

export async function GET(req: NextRequest) {
  try {
    const auth = await withAuth(req);
    const check = withRole(auth, ["ADMIN", "SUPER_ADMIN", "SUPPORT"]);
    if (!check.ok) return check.response;

    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      since: searchParams.get("since") ?? undefined,
      limit: searchParams.get("limit") ?? 30,
      types: searchParams.get("types") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: { code: "INVALID_PARAMS" } }, { status: 422 });
    }

    const { since, limit, types } = parsed.data;
    const typeFilter = types ? types.split(",").map(t => t.trim()).filter(Boolean) : undefined;

    const where: Record<string, unknown> = {};
    if (since) where.createdAt = { gt: new Date(since) };
    if (typeFilter?.length) where.type = { in: typeFilter };

    const [events, health] = await Promise.all([
      prisma.eventLog.findMany({
        where:   where as any,
        orderBy: { createdAt: "desc" },
        take:    limit,
        select:  { id: true, type: true, payload: true, status: true, createdAt: true },
      }),
      getQueueHealth(),
    ]);

    // Latest event ID for the client cursor
    const cursor = events[0]?.createdAt?.toISOString() ?? null;

    return NextResponse.json({
      data: { events, cursor, health },
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[Admin/Stream]", err);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}
