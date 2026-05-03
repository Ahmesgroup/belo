// ============================================================
// services/plan.service.ts — Plan synchronisation
//
// When a plan's pricing/limits/features are updated in the admin,
// this service propagates the changes to all active tenants on
// that plan and logs the operation.
// ============================================================

import { prisma } from "@/infrastructure/db/prisma";
import { createAuditLog } from "@/lib/audit";
import { emitEvent } from "@/lib/events";
import { invalidateSettingsCache } from "@/lib/settings";

export interface PlanSyncResult {
  plan:    string;
  updated: number;
  details: string;
}

/**
 * Called after an admin updates a plan's pricing, limits, or features.
 * 1. Counts active tenants on this plan (visibility/analytics)
 * 2. Emits plan.updated event (triggers audit log + other handlers)
 * 3. Sends internal notification to affected owners (future: via outbox)
 *
 * Note: actual quota enforcement happens at domain level (booking.rules.ts).
 * No tenant record update is needed — quotas are derived at read time.
 */
export async function syncPlanToTenants(
  plan:    string,
  changes: Record<string, unknown>,
  adminId: string
): Promise<PlanSyncResult> {
  const tenants = await prisma.tenant.findMany({
    where:  { plan: plan as any, status: "ACTIVE", deletedAt: null },
    select: { id: true, name: true },
  });

  // Emit event — handlers will create the audit log and do other effects
  await emitEvent("plan.updated", {
    plan,
    changes,
    adminId,
    tenantCount: tenants.length,
  });

  const details = `${tenants.length} salon(s) actif(s) sur le plan ${plan} affecté(s)`;
  return { plan, updated: tenants.length, details };
}

/**
 * Recalculates and resets the monthly booking quota for a tenant.
 * Called when a tenant upgrades/downgrades their plan mid-month.
 */
export async function resetTenantQuota(tenantId: string, adminId?: string): Promise<void> {
  await prisma.tenant.update({
    where: { id: tenantId },
    data:  { bookingsUsedMonth: 0, bookingsResetAt: new Date() },
  });

  await createAuditLog({
    action:   "tenant.quota_reset",
    entity:   "Tenant",
    entityId: tenantId,
    tenantId,
    actorId:  adminId ?? null,
    newValue: { bookingsUsedMonth: 0 },
  });
}

/**
 * Invalidates all caches after a settings change.
 * Call after updating SystemSetting records.
 */
export function onSettingsUpdated(): void {
  invalidateSettingsCache();
}
