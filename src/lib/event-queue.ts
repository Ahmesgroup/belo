// ============================================================
// lib/event-queue.ts — EventLog retry processor
//
// The EventLog table acts as a durable queue.
// emitEvent() writes "pending" entries.
// This module is called by the /api/cron/events endpoint to:
//  - Pick up pending entries with remaining retries
//  - Re-dispatch them through the in-process handler registry
//  - Mark as "processed" or increment retry count on failure
//
// Uses SKIP LOCKED for concurrent-safe processing when multiple
// cron invocations overlap.
// ============================================================

import { prisma } from "@/infrastructure/db/prisma";
import { emitEvent, type AppEvent, type EventPayloads } from "@/lib/events";

export interface QueueStats {
  processed: number;
  failed:    number;
  skipped:   number;
}

/**
 * Processes a batch of pending EventLog entries.
 * Safe to call concurrently — uses SELECT FOR UPDATE SKIP LOCKED.
 */
export async function processEventQueue(batchSize = 50): Promise<QueueStats> {
  // Claim a batch of pending events atomically
  const events = await prisma.$queryRaw<Array<{
    id: string; type: string; payload: unknown; retries: number; maxRetries: number;
  }>>`
    SELECT id, type, payload, retries, "maxRetries"
    FROM "EventLog"
    WHERE status = 'pending'
      AND retries < "maxRetries"
    ORDER BY "createdAt" ASC
    LIMIT ${batchSize}
    FOR UPDATE SKIP LOCKED
  `;

  let processed = 0;
  let failed    = 0;
  let skipped   = 0;

  for (const event of events) {
    // Mark as processing to prevent double-pick
    await prisma.eventLog.update({
      where: { id: event.id },
      data:  { status: "processing" },
    });

    try {
      // Re-dispatch through the handler registry (handlers are already registered
      // via the side-effect import of event-handlers.ts in this cron route)
      await emitEvent(event.type as AppEvent, event.payload as EventPayloads[AppEvent]);

      await prisma.eventLog.update({
        where: { id: event.id },
        data:  { status: "processed", processedAt: new Date() },
      });
      processed++;
    } catch (err) {
      const newRetries = event.retries + 1;
      const newStatus  = newRetries >= event.maxRetries ? "failed" : "pending";

      await prisma.eventLog.update({
        where: { id: event.id },
        data:  {
          status:  newStatus,
          retries: newRetries,
          error:   String(err).slice(0, 500),
        },
      });
      failed++;
    }
  }

  return { processed, failed, skipped };
}

/**
 * Returns a summary of the EventLog queue health.
 * Used by the admin Mission Control panel.
 */
export async function getQueueHealth(): Promise<{
  pending:    number;
  processing: number;
  processed:  number;
  failed:     number;
}> {
  const counts = await prisma.eventLog.groupBy({
    by:     ["status"],
    _count: { _all: true },
  });

  const map = Object.fromEntries(counts.map(r => [r.status, r._count._all]));
  return {
    pending:    map.pending    ?? 0,
    processing: map.processing ?? 0,
    processed:  map.processed  ?? 0,
    failed:     map.failed     ?? 0,
  };
}
