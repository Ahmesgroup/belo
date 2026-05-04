// GET /api/cron/events
//
// Processes the EventLog retry queue.
// Called by Vercel Cron every 2 minutes.
//
// Picks up pending EventLog entries whose retries < maxRetries,
// re-dispatches them through the handler registry, and marks
// them as processed or increments their retry count.

import "@/lib/event-handlers"; // register handlers before processing

import { NextRequest, NextResponse } from "next/server";
import { processEventQueue, getQueueHealth } from "@/lib/event-queue";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const start = Date.now();
    const [stats, health] = await Promise.all([
      processEventQueue(100),
      getQueueHealth(),
    ]);

    return NextResponse.json({
      ok:       true,
      duration: `${Date.now() - start}ms`,
      stats,
      health,
    });
  } catch (err) {
    console.error("[Cron/Events]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
