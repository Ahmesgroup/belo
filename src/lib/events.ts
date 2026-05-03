// ============================================================
// lib/events.ts — Synchronous in-process event bus
//
// Design choice: synchronous (not async queue) because:
//  • Vercel serverless — no shared memory between requests
//  • Side-effects (audit log, fraud check) must complete in the
//    same request or be persisted via the outbox pattern
//  • Errors in handlers are caught and logged, never crash the caller
//
// Usage:
//   import { emitEvent } from "@/lib/events";
//   await emitEvent("tenant.blocked", { tenantId, adminId, reason });
//
//   import { onEvent } from "@/lib/events";
//   onEvent("tenant.blocked", async (p) => { ... });
// ============================================================

// ── Typed event payloads ──────────────────────────────────────

export type EventPayloads = {
  "tenant.blocked":    { tenantId: string; tenantName?: string; adminId?: string; reason?: string };
  "tenant.activated":  { tenantId: string; tenantName?: string; adminId?: string };
  "tenant.suspended":  { tenantId: string; tenantName?: string; adminId?: string; reason?: string };
  "plan.updated":      { plan: string; changes: Record<string, unknown>; adminId?: string; tenantCount?: number };
  "payment.failed":    { bookingId: string; tenantId: string; userId?: string; reason?: string };
  "booking.created":   { bookingId: string; tenantId: string; userId: string; priceCents: number };
  "booking.cancelled": { bookingId: string; tenantId: string; cancelledBy?: string; reason?: string };
  "fraud.detected":    { tenantId: string; tenantName?: string; riskScore: number; signals: string[] };
};

export type AppEvent   = keyof EventPayloads;
type Handler<E extends AppEvent> = (payload: EventPayloads[E]) => void | Promise<void>;

// ── In-process registry (lives for the lifetime of the Node.js module cache) ──

const registry = new Map<AppEvent, Array<Handler<AppEvent>>>();

/**
 * Register a handler for an event type.
 * Handlers registered at module-load time persist for the warm serverless instance.
 */
export function onEvent<E extends AppEvent>(event: E, handler: Handler<E>): void {
  const list = registry.get(event) ?? [];
  list.push(handler as Handler<AppEvent>);
  registry.set(event, list);
}

/**
 * Emit an event and await all registered handlers sequentially.
 * A handler error is caught, logged, and skipped — it never aborts the chain.
 */
export async function emitEvent<E extends AppEvent>(
  event: E,
  payload: EventPayloads[E]
): Promise<void> {
  const handlers = registry.get(event) ?? [];
  for (const handler of handlers) {
    try {
      await handler(payload as EventPayloads[AppEvent]);
    } catch (err) {
      console.error(`[Events] handler for "${event}" threw:`, err);
    }
  }
}

/** Useful for testing — clears all handlers. Never call in production code. */
export function _clearHandlers(): void {
  registry.clear();
}
