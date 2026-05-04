// ============================================================
// lib/events.ts — In-process event bus + persistent EventLog
//
// Two responsibilities:
//  1. Synchronous handler dispatch (immediate effects: audit logs,
//     fraud checks) via the in-process registry.
//  2. Non-blocking persistence to EventLog (for replay, retry,
//     and the real-time admin stream).
//
// The EventLog write is fire-and-forget: it never blocks the caller
// and a write failure does NOT prevent handlers from running.
// ============================================================

import { prisma } from "@/infrastructure/db/prisma";

// ── Typed event payloads ──────────────────────────────────────

export type EventPayloads = {
  "tenant.blocked":    { tenantId: string; tenantName?: string; adminId?: string; reason?: string };
  "tenant.activated":  { tenantId: string; tenantName?: string; adminId?: string };
  "tenant.suspended":  { tenantId: string; tenantName?: string; adminId?: string; reason?: string };
  "tenant.created":    { tenantId: string; tenantName: string; ownerId: string; plan?: string };
  "plan.updated":      { plan: string; changes: Record<string, unknown>; adminId?: string; tenantCount?: number };
  "payment.failed":    { bookingId: string; tenantId: string; userId?: string; reason?: string };
  "booking.created":   { bookingId: string; tenantId: string; userId: string; priceCents: number };
  "booking.cancelled": { bookingId: string; tenantId: string; cancelledBy?: string; reason?: string };
  "fraud.detected":    { tenantId: string; tenantName?: string; riskScore: number; signals: string[] };
  "settings.updated":  { keys: string[]; adminId?: string };
};

export type AppEvent   = keyof EventPayloads;
type Handler<E extends AppEvent> = (payload: EventPayloads[E]) => void | Promise<void>;

// ── In-process registry ───────────────────────────────────────

const registry = new Map<AppEvent, Array<Handler<AppEvent>>>();

export function onEvent<E extends AppEvent>(event: E, handler: Handler<E>): void {
  const list = registry.get(event) ?? [];
  list.push(handler as Handler<AppEvent>);
  registry.set(event, list);
}

// ── Emit ──────────────────────────────────────────────────────

/**
 * Emit an event:
 *  1. Persists to EventLog (non-blocking, fire-and-forget)
 *  2. Runs all registered handlers synchronously
 *
 * Handler errors are caught and logged — they never abort the chain.
 */
export async function emitEvent<E extends AppEvent>(
  event:   E,
  payload: EventPayloads[E]
): Promise<void> {
  // 1. Persist to EventLog — fire-and-forget, never blocks handlers
  prisma.eventLog
    .create({ data: { type: event, payload: payload as any, status: "pending" } })
    .catch(err => console.error(`[EventLog] persist failed for "${event}":`, err));

  // 2. Run handlers
  const handlers = registry.get(event) ?? [];
  for (const handler of handlers) {
    try {
      await handler(payload as EventPayloads[AppEvent]);
    } catch (err) {
      console.error(`[Events] handler for "${event}" threw:`, err);
    }
  }
}

/** Useful for testing only — clears all handlers. */
export function _clearHandlers(): void {
  registry.clear();
}
