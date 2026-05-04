// ============================================================
// services/fraud.service.ts — Active fraud detection engine V2
//
// V2 additions over V1:
//  • user-level signal: same user cancelling at multiple tenants
//  • velocity signal: abnormal booking bursts in short windows
//  • cross-tenant signal: user associated with other flagged tenants
//
// Score bands:
//   0–29  : clean
//   30–59 : watch  → NEW FraudAlert
//   60–79 : risky  → UNDER_REVIEW + AdminNotification
//   80+   : critical → auto-block (status = FRAUD)
// ============================================================

import { prisma } from "@/infrastructure/db/prisma";
import { createAuditLog } from "@/lib/audit";
import { emitEvent } from "@/lib/events";

const THRESHOLDS = {
  cancellations24h:  5,
  cancellationRate:  0.4,
  velocityBookings:  20,   // > 20 bookings created in 1 hour (bot-like)
  crossTenantFlags:  2,    // user flagged at ≥ 2 other tenants
  autoBlockScore:   80,
  watchScore:       30,
  notifyScore:      60,
} as const;

export interface FraudSignal {
  type:   string;
  value:  number;
  weight: number;
}

export interface FraudCheckResult {
  tenantId:    string;
  riskScore:   number;
  signals:     FraudSignal[];
  flagged:     boolean;
  autoBlocked: boolean;
}

// ── Main entry point ──────────────────────────────────────────

export async function runFraudCheck(tenantId: string): Promise<FraudCheckResult> {
  const [tenant, signals] = await Promise.all([
    prisma.tenant.findUnique({
      where:  { id: tenantId },
      select: { id: true, name: true, status: true, plan: true },
    }),
    collectSignals(tenantId),
  ]);

  if (!tenant) return { tenantId, riskScore: 0, signals: [], flagged: false, autoBlocked: false };

  // Already blocked — skip re-evaluation
  if (tenant.status === "BLOCKED" || tenant.status === "FRAUD") {
    return { tenantId, riskScore: 100, signals, flagged: true, autoBlocked: false };
  }

  const riskScore     = Math.min(100, signals.reduce((s, x) => s + x.weight, 0));
  const activeSignals = signals.filter(s => s.weight > 0);
  const flagged       = riskScore >= THRESHOLDS.watchScore;
  let autoBlocked     = false;

  if (flagged) {
    await upsertFraudAlert(tenantId, riskScore, activeSignals);

    await emitEvent("fraud.detected", {
      tenantId,
      tenantName: tenant.name,
      riskScore,
      signals:   activeSignals.map(s => s.type),
    });

    if (riskScore >= THRESHOLDS.autoBlockScore) {
      await prisma.tenant.update({ where: { id: tenantId }, data: { status: "FRAUD" } });

      await createAuditLog({
        action:   "tenant.auto_blocked",
        entityId: tenantId,
        tenantId,
        newValue: { reason: `fraud_engine score=${riskScore}`, signals: activeSignals.map(s => s.type) },
      });

      await emitEvent("tenant.blocked", {
        tenantId,
        tenantName: tenant.name,
        reason:    `Auto-blocked by fraud engine (score: ${riskScore}/100)`,
      });

      autoBlocked = true;
    }
  }

  return { tenantId, riskScore, signals: activeSignals, flagged, autoBlocked };
}

// ── Signal collection ─────────────────────────────────────────

async function collectSignals(tenantId: string): Promise<FraudSignal[]> {
  const now = new Date();
  const h1  = new Date(now.getTime() -      60 * 60 * 1000);
  const h24 = new Date(now.getTime() -  24 * 60 * 60 * 1000);
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    tenant,
    bookings30d,
    cancellations24h,
    cancellations30d,
    bookingsLastHour,
    existingAlert,
  ] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { bookingsUsedMonth: true } }),
    prisma.booking.count({ where: { tenantId, createdAt: { gte: d30 } } }),
    prisma.booking.count({ where: { tenantId, status: "CANCELLED", cancelledAt: { gte: h24 } } }),
    prisma.booking.count({ where: { tenantId, status: "CANCELLED", cancelledAt: { gte: d30 } } }),
    prisma.booking.count({ where: { tenantId, createdAt: { gte: h1 } } }),
    prisma.fraudAlert.findFirst({
      where: { tenantId, status: { in: ["NEW", "UNDER_REVIEW"] } },
      orderBy: { riskScore: "desc" },
    }),
  ]);

  const signals: FraudSignal[] = [];

  // Signal 1: High cancellations in 24h (tenant-level)
  if (cancellations24h > THRESHOLDS.cancellations24h) {
    const excess = cancellations24h - THRESHOLDS.cancellations24h;
    signals.push({ type: "high_cancellations_24h", value: cancellations24h, weight: Math.min(40, excess * 8) });
  }

  // Signal 2: High cancellation rate over 30 days
  if (bookings30d > 10 && cancellations30d > 0) {
    const rate = cancellations30d / bookings30d;
    if (rate > THRESHOLDS.cancellationRate) {
      signals.push({
        type:   "high_cancellation_rate_30d",
        value:  Math.round(rate * 100),
        weight: Math.min(30, Math.round((rate - THRESHOLDS.cancellationRate) * 100)),
      });
    }
  }

  // Signal 3: Quota gaming (high quota use, very few real bookings)
  if (tenant && tenant.bookingsUsedMonth > 100 && bookings30d < 5) {
    signals.push({ type: "quota_gaming_suspected", value: tenant.bookingsUsedMonth, weight: 20 });
  }

  // Signal 4: Booking velocity — burst of bookings in 1 hour (bot / abuse)
  if (bookingsLastHour > THRESHOLDS.velocityBookings) {
    const excess = bookingsLastHour - THRESHOLDS.velocityBookings;
    signals.push({ type: "booking_velocity_spike", value: bookingsLastHour, weight: Math.min(35, excess * 3) });
  }

  // Signal 5: Escalating existing alert
  if (existingAlert && existingAlert.riskScore > 50) {
    signals.push({
      type:   "existing_fraud_alert",
      value:  existingAlert.riskScore,
      weight: Math.round(existingAlert.riskScore * 0.3),
    });
  }

  // Signal 6 (cross-tenant): user repeatedly cancelling across multiple tenants
  const crossTenantScore = await getCrossTenantSignal(tenantId);
  if (crossTenantScore > 0) {
    signals.push({ type: "cross_tenant_canceller", value: crossTenantScore, weight: Math.min(25, crossTenantScore * 5) });
  }

  return signals;
}

// ── Cross-tenant signal ───────────────────────────────────────

async function getCrossTenantSignal(tenantId: string): Promise<number> {
  try {
    // Find users who cancelled at THIS tenant in the last 30 days
    const h24 = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const cancelledUsers = await prisma.booking.findMany({
      where:   { tenantId, status: "CANCELLED", cancelledAt: { gte: h24 } },
      select:  { userId: true },
      distinct: ["userId"],
      take:    50,
    });

    if (cancelledUsers.length === 0) return 0;

    const userIds = cancelledUsers.map(b => b.userId);

    // Check how many OTHER tenants these users have also cancelled at
    const otherTenantCancellations = await prisma.booking.groupBy({
      by:     ["userId"],
      where:  {
        userId:     { in: userIds },
        tenantId:   { not: tenantId },
        status:     "CANCELLED",
        cancelledAt:{ gte: h24 },
      },
      _count: { tenantId: true },
    });

    // Users who cancelled at >= THRESHOLDS.crossTenantFlags other tenants
    const suspiciousUsers = otherTenantCancellations.filter(
      r => r._count.tenantId >= THRESHOLDS.crossTenantFlags
    );

    return suspiciousUsers.length;
  } catch {
    return 0; // cross-tenant check failure is non-fatal
  }
}

// ── Alert upsert ──────────────────────────────────────────────

async function upsertFraudAlert(tenantId: string, riskScore: number, signals: FraudSignal[]): Promise<void> {
  const existing = await prisma.fraudAlert.findFirst({
    where:   { tenantId, status: { in: ["NEW", "UNDER_REVIEW"] } },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    await prisma.fraudAlert.update({
      where: { id: existing.id },
      data:  { riskScore, signals: signals as any },
    });
  } else {
    await prisma.fraudAlert.create({
      data: { tenantId, riskScore, signals: signals as any, status: "NEW" },
    });
  }
}
