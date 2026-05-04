// ============================================================
// lib/domain-events.ts — Typed Domain Event factories (DDD)
//
// Each factory function returns a structured DomainEvent object
// with a correlation ID, timestamp, and strongly-typed payload.
//
// Usage:
//   import { DomainEvents, emitDomainEvent } from "@/lib/domain-events";
//
//   await emitDomainEvent(
//     DomainEvents.tenantBlocked({ tenantId, adminId, reason })
//   );
// ============================================================

import { emitEvent, type EventPayloads, type AppEvent } from "@/lib/events";

// ── Domain event envelope ─────────────────────────────────────

export interface DomainEvent<E extends AppEvent = AppEvent> {
  readonly eventId:       string;      // unique correlation ID
  readonly type:          E;
  readonly payload:       EventPayloads[E];
  readonly occurredAt:    Date;
  readonly schemaVersion: number;
}

function createDomainEvent<E extends AppEvent>(
  type:    E,
  payload: EventPayloads[E]
): DomainEvent<E> {
  return {
    eventId:       crypto.randomUUID(),
    type,
    payload,
    occurredAt:    new Date(),
    schemaVersion: 1,
  };
}

// ── Factory functions — one per event type ────────────────────

export const DomainEvents = {
  tenantBlocked:   (p: EventPayloads["tenant.blocked"])   => createDomainEvent("tenant.blocked",   p),
  tenantActivated: (p: EventPayloads["tenant.activated"]) => createDomainEvent("tenant.activated", p),
  tenantSuspended: (p: EventPayloads["tenant.suspended"]) => createDomainEvent("tenant.suspended", p),
  tenantCreated:   (p: EventPayloads["tenant.created"])   => createDomainEvent("tenant.created",   p),
  planUpdated:     (p: EventPayloads["plan.updated"])     => createDomainEvent("plan.updated",     p),
  paymentFailed:   (p: EventPayloads["payment.failed"])   => createDomainEvent("payment.failed",   p),
  bookingCreated:  (p: EventPayloads["booking.created"])  => createDomainEvent("booking.created",  p),
  bookingCancelled:(p: EventPayloads["booking.cancelled"])=> createDomainEvent("booking.cancelled",p),
  fraudDetected:   (p: EventPayloads["fraud.detected"])   => createDomainEvent("fraud.detected",   p),
  settingsUpdated: (p: EventPayloads["settings.updated"]) => createDomainEvent("settings.updated", p),
} as const;

/**
 * Emits a strongly-typed domain event.
 * Wraps emitEvent() with the DomainEvent envelope.
 */
export async function emitDomainEvent<E extends AppEvent>(
  event: DomainEvent<E>
): Promise<void> {
  await emitEvent(event.type, event.payload);
}
