// ============================================================
// lib/audit.ts — Centralized audit log creation
//
// Single function used everywhere: events, admin actions,
// payments, auth. Never throws — a failed audit log must
// not break the main operation.
// ============================================================

import { prisma } from "@/infrastructure/db/prisma";

export interface AuditOptions {
  action:    string;           // "tenant.blocked" | "booking.created" | ...
  entity?:   string;           // "Tenant" | "Booking" | "User" | ...
  entityId?: string;
  actorId?:  string | null;    // userId who triggered the action
  tenantId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ip?:       string;
}

export async function createAuditLog(opts: AuditOptions): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action:   opts.action,
        entity:   opts.entity   ?? inferEntity(opts.action),
        entityId: opts.entityId ?? opts.tenantId ?? "unknown",
        actorId:  opts.actorId  ?? null,
        tenantId: opts.tenantId ?? null,
        oldValue: (opts.oldValue as any)  ?? undefined,
        newValue: (opts.newValue as any)  ?? undefined,
        ip:       opts.ip ?? null,
      },
    });
  } catch (err) {
    // Non-blocking — audit log failures must never crash the caller
    console.error("[AuditLog] Failed:", opts.action, err);
  }
}

function inferEntity(action: string): string {
  const [ns] = action.split(".");
  const map: Record<string, string> = {
    tenant:  "Tenant",
    booking: "Booking",
    payment: "Payment",
    plan:    "Plan",
    fraud:   "FraudAlert",
    auth:    "User",
    team:    "User",
    settings:"SystemSetting",
  };
  return map[ns] ?? "System";
}
