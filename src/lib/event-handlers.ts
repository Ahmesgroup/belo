// ============================================================
// lib/event-handlers.ts — Central event wiring
//
// Registers all event handlers exactly ONCE per warm instance.
// Import this module as a side effect before calling emitEvent():
//
//   import "@/lib/event-handlers";
//
// IMPORT GRAPH (no circular deps):
//   events.ts         ← prisma only
//   audit.ts          ← prisma
//   fraud.service.ts  ← events.ts + audit.ts + prisma
//   plan.service.ts   ← events.ts + audit.ts + prisma + settings.ts
//   event-handlers.ts ← events.ts + audit.ts + fraud.service + plan.service + prisma
// ============================================================

import { onEvent } from "@/lib/events";
import { createAuditLog } from "@/lib/audit";
import { runFraudCheck } from "@/services/fraud.service";
import { invalidateSettingsCache } from "@/lib/settings";
import { prisma } from "@/infrastructure/db/prisma";

let registered = false;
if (!registered) {
  registered = true;

  // ── tenant.blocked ──────────────────────────────────────────
  onEvent("tenant.blocked", async ({ tenantId, tenantName, adminId, reason }) => {
    await createAuditLog({
      action: "tenant.blocked", entityId: tenantId, tenantId, actorId: adminId,
      newValue: { reason, tenantName },
    });
  });

  // ── tenant.activated ─────────────────────────────────────────
  onEvent("tenant.activated", async ({ tenantId, tenantName, adminId }) => {
    await createAuditLog({
      action: "tenant.activated", entityId: tenantId, tenantId, actorId: adminId,
      newValue: { tenantName },
    });
    // Mark any pending AdminNotification for this tenant as read
    await prisma.adminNotification.updateMany({
      where: { tenantId, type: "tenant_validation_required", read: false },
      data:  { read: true },
    });
  });

  // ── tenant.suspended ─────────────────────────────────────────
  onEvent("tenant.suspended", async ({ tenantId, tenantName, adminId, reason }) => {
    await createAuditLog({
      action: "tenant.suspended", entityId: tenantId, tenantId, actorId: adminId,
      newValue: { reason, tenantName },
    });
  });

  // ── tenant.created ────────────────────────────────────────────
  onEvent("tenant.created", async ({ tenantId, tenantName, ownerId, plan }) => {
    await createAuditLog({
      action: "tenant.created", entityId: tenantId, tenantId, actorId: ownerId,
      newValue: { tenantName, plan },
    });
    // Create admin notification — admins need to validate the new salon
    await prisma.adminNotification.create({
      data: {
        type:     "tenant_validation_required",
        title:    `Nouveau salon : ${tenantName}`,
        body:     `En attente de validation. Plan : ${plan ?? "FREE"}.`,
        tenantId,
        metadata: { ownerId, plan },
      },
    });
  });

  // ── plan.updated ─────────────────────────────────────────────
  onEvent("plan.updated", async ({ plan, changes, adminId, tenantCount }) => {
    await createAuditLog({
      action: "plan.updated", entity: "Plan", entityId: plan, actorId: adminId,
      newValue: { changes, tenantsAffected: tenantCount },
    });
    invalidateSettingsCache();
  });

  // ── payment.failed ────────────────────────────────────────────
  onEvent("payment.failed", async ({ bookingId, tenantId, reason }) => {
    await createAuditLog({
      action: "payment.failed", entity: "Booking", entityId: bookingId, tenantId,
      newValue: { reason },
    });
    await runFraudCheck(tenantId);
  });

  // ── booking.created ───────────────────────────────────────────
  onEvent("booking.created", async ({ bookingId, tenantId, userId, priceCents }) => {
    await createAuditLog({
      action: "booking.created", entity: "Booking", entityId: bookingId,
      tenantId, actorId: userId, newValue: { priceCents },
    });
  });

  // ── booking.cancelled ─────────────────────────────────────────
  onEvent("booking.cancelled", async ({ bookingId, tenantId, reason }) => {
    await createAuditLog({
      action: "booking.cancelled", entity: "Booking", entityId: bookingId,
      tenantId, newValue: { reason },
    });
    // Run fraud check — high cancellation rate is a fraud signal
    await runFraudCheck(tenantId);
  });

  // ── fraud.detected ────────────────────────────────────────────
  onEvent("fraud.detected", async ({ tenantId, tenantName, riskScore, signals }) => {
    await createAuditLog({
      action: "fraud.detected", entity: "FraudAlert", entityId: tenantId,
      tenantId, newValue: { riskScore, signals, tenantName },
    });
    // Create admin notification for high-risk alerts
    if (riskScore >= 60) {
      await prisma.adminNotification.create({
        data: {
          type:     "fraud_alert",
          title:    `⚠️ Alerte fraude : ${tenantName ?? tenantId}`,
          body:     `Score de risque : ${riskScore}/100. Signaux : ${signals.join(", ")}.`,
          tenantId,
          metadata: { riskScore, signals },
        },
      });
    }
    console.warn(`[Fraud] ${tenantName ?? tenantId} → ${riskScore}/100. Signals: ${signals.join(", ")}`);
  });

  // ── settings.updated ─────────────────────────────────────────
  onEvent("settings.updated", async ({ keys, adminId }) => {
    await createAuditLog({
      action: "settings.updated", entity: "SystemSetting", entityId: "global",
      actorId: adminId, newValue: { keys },
    });
    // Invalidate local cache — all in-process code re-reads on next access
    invalidateSettingsCache();
  });
}
