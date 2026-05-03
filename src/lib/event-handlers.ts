// ============================================================
// lib/event-handlers.ts — Central event wiring
//
// This module registers all event handlers exactly ONCE when
// it is first imported (Node.js module cache ensures that).
//
// HOW TO USE:
//   Add  import "@/lib/event-handlers";  as the FIRST import in
//   any service or API route that calls emitEvent().
//   This guarantees handlers are registered before the event fires.
//
// IMPORT GRAPH (no circular deps):
//   events.ts         ← no service imports
//   audit.ts          ← prisma
//   fraud.service.ts  ← events.ts, audit.ts, prisma
//   plan.service.ts   ← events.ts, audit.ts, prisma
//   event-handlers.ts ← events.ts, audit.ts, fraud.service, plan.service
//   booking.service   ← event-handlers (side effect), events.ts
//   admin routes      ← event-handlers (side effect), events.ts
// ============================================================

import { onEvent } from "@/lib/events";
import { createAuditLog } from "@/lib/audit";
import { runFraudCheck } from "@/services/fraud.service";
import { invalidateSettingsCache } from "@/lib/settings";

// ── Deduplication guard ───────────────────────────────────────
// Node module cache means this file runs once per warm instance.
// The guard is a safety net for HMR / hot reload in dev.

let registered = false;
if (!registered) {
  registered = true;

  // ── tenant.blocked ──────────────────────────────────────────
  onEvent("tenant.blocked", async ({ tenantId, tenantName, adminId, reason }) => {
    await createAuditLog({
      action:   "tenant.blocked",
      entityId: tenantId,
      tenantId,
      actorId:  adminId,
      newValue: { reason, tenantName },
    });
  });

  // ── tenant.activated ─────────────────────────────────────────
  onEvent("tenant.activated", async ({ tenantId, tenantName, adminId }) => {
    await createAuditLog({
      action:   "tenant.activated",
      entityId: tenantId,
      tenantId,
      actorId:  adminId,
      newValue: { tenantName },
    });
  });

  // ── tenant.suspended ─────────────────────────────────────────
  onEvent("tenant.suspended", async ({ tenantId, tenantName, adminId, reason }) => {
    await createAuditLog({
      action:   "tenant.suspended",
      entityId: tenantId,
      tenantId,
      actorId:  adminId,
      newValue: { reason, tenantName },
    });
  });

  // ── plan.updated ─────────────────────────────────────────────
  onEvent("plan.updated", async ({ plan, changes, adminId, tenantCount }) => {
    await createAuditLog({
      action:   "plan.updated",
      entity:   "Plan",
      entityId: plan,
      actorId:  adminId,
      newValue: { changes, tenantsAffected: tenantCount },
    });
    // Invalidate settings cache so limits are re-read
    invalidateSettingsCache();
  });

  // ── payment.failed ────────────────────────────────────────────
  onEvent("payment.failed", async ({ bookingId, tenantId, reason }) => {
    await createAuditLog({
      action:   "payment.failed",
      entity:   "Booking",
      entityId: bookingId,
      tenantId,
      newValue: { reason },
    });
    // Run fraud check — repeated payment failures increase risk score
    await runFraudCheck(tenantId);
  });

  // ── booking.created ───────────────────────────────────────────
  onEvent("booking.created", async ({ bookingId, tenantId, userId, priceCents }) => {
    await createAuditLog({
      action:   "booking.created",
      entity:   "Booking",
      entityId: bookingId,
      tenantId,
      actorId:  userId,
      newValue: { priceCents },
    });
  });

  // ── booking.cancelled ─────────────────────────────────────────
  onEvent("booking.cancelled", async ({ bookingId, tenantId, reason }) => {
    await createAuditLog({
      action:   "booking.cancelled",
      entity:   "Booking",
      entityId: bookingId,
      tenantId,
      newValue: { reason },
    });
    // Run fraud check — high cancellation rate is a fraud signal
    await runFraudCheck(tenantId);
  });

  // ── fraud.detected ────────────────────────────────────────────
  onEvent("fraud.detected", async ({ tenantId, tenantName, riskScore, signals }) => {
    await createAuditLog({
      action:   "fraud.detected",
      entity:   "FraudAlert",
      entityId: tenantId,
      tenantId,
      newValue: { riskScore, signals, tenantName },
    });
    // Console alert for ops visibility (Sentry / log aggregator picks this up)
    console.warn(`[Fraud] Tenant ${tenantName ?? tenantId} scored ${riskScore}/100. Signals: ${signals.join(", ")}`);
  });
}
