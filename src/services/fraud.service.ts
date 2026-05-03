// ============================================================
// services/fraud.service.ts — Active fraud detection engine
//
// Called after key events (cancellations, payment failures).
// Computes a risk score from multiple signals, creates/updates
// a FraudAlert, and auto-blocks if score exceeds the threshold.
//
// Score bands:
//   0–29  : clean (no alert)
//   30–59 : watch (NEW alert created)
//   60–79 : risky (alert escalated)
//   80+   : auto-block → tenant.status = FRAUD
// ============================================================

import { prisma } from "@/infrastructure/db/prisma";
import { createAuditLog } from "@/lib/audit";
import { emitEvent } from "@/lib/events";

// ── Thresholds ────────────────────────────────────────────────

const THRESHOLDS = {
  cancellations24h:  5,   // > 5 cancels in 24h → flagged
  cancellationRate:  0.4, // > 40% cancel rate → suspicious
  paymentFailures:   3,   // > 3 payment failures → risk
  autoBlockScore:   80,   // score ≥ 80 → auto FRAUD + block
  watchScore:       30,   // score ≥ 30 → create alert
};

export interface FraudSignal {
  type:   string;
  value:  number;
  weight: number; // contribution to score (0-100)
}

export interface FraudCheckResult {
  tenantId:  string;
  riskScore: number;
  signals:   FraudSignal[];
  flagged:   boolean;
  autoBlocked: boolean;
}

// ── Main entry point ──────────────────────────────────────────

/**
 * Runs a full fraud analysis for a tenant.
 * Creates or updates a FraudAlert in the DB.
 * Auto-blocks if score ≥ THRESHOLDS.autoBlockScore.
 */
export async function runFraudCheck(tenantId: string): Promise<FraudCheckResult> {
  const [tenant, signals] = await Promise.all([
    prisma.tenant.findUnique({
      where:  { id: tenantId },
      select: { id: true, name: true, status: true, plan: true },
    }),
    collectSignals(tenantId),
  ]);

  if (!tenant) return { tenantId, riskScore: 0, signals: [], flagged: false, autoBlocked: false };

  // Already blocked — don't re-run
  if (tenant.status === "BLOCKED" || tenant.status === "FRAUD") {
    return { tenantId, riskScore: 100, signals, flagged: true, autoBlocked: false };
  }

  const riskScore    = Math.min(100, signals.reduce((sum, s) => sum + s.weight, 0));
  const activeSignals = signals.filter(s => s.weight > 0);
  const flagged      = riskScore >= THRESHOLDS.watchScore;
  let autoBlocked    = false;

  if (flagged) {
    await upsertFraudAlert(tenantId, riskScore, activeSignals);

    // Emit fraud.detected for new/rising alerts
    await emitEvent("fraud.detected", {
      tenantId,
      tenantName: tenant.name,
      riskScore,
      signals:   activeSignals.map(s => s.type),
    });

    // Auto-block if critical
    if (riskScore >= THRESHOLDS.autoBlockScore) {
      await prisma.tenant.update({
        where: { id: tenantId },
        data:  { status: "FRAUD" },
      });

      await createAuditLog({
        action:   "tenant.auto_blocked",
        entity:   "Tenant",
        entityId: tenantId,
        tenantId,
        newValue: { reason: `Auto-blocked: fraud score ${riskScore}/100`, signals: activeSignals.map(s => s.type) },
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
  const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    bookings30d,
    cancellations24h,
    cancellations30d,
  ] = await Promise.all([
    prisma.booking.count({ where: { tenantId, createdAt: { gte: d30 } } }),
    prisma.booking.count({ where: { tenantId, status: "CANCELLED", cancelledAt: { gte: h24 } } }),
    prisma.booking.count({ where: { tenantId, status: "CANCELLED", cancelledAt: { gte: d30 } } }),
  ]);

  const signals: FraudSignal[] = [];

  // Signal 1: High cancellations in 24 hours
  if (cancellations24h > THRESHOLDS.cancellations24h) {
    const excess = cancellations24h - THRESHOLDS.cancellations24h;
    signals.push({
      type:   "high_cancellations_24h",
      value:  cancellations24h,
      weight: Math.min(40, excess * 8),
    });
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

  // Signal 3: Low booking volume despite high quota usage (gaming the system)
  const tenant = await prisma.tenant.findUnique({
    where:  { id: tenantId },
    select: { bookingsUsedMonth: true },
  });
  if (tenant && tenant.bookingsUsedMonth > 100 && bookings30d < 5) {
    signals.push({
      type:   "quota_gaming_suspected",
      value:  tenant.bookingsUsedMonth,
      weight: 20,
    });
  }

  // Signal 4: Existing fraud alerts with high score
  const existingAlert = await prisma.fraudAlert.findFirst({
    where:   { tenantId, status: { in: ["NEW", "UNDER_REVIEW"] } },
    orderBy: { riskScore: "desc" },
  });
  if (existingAlert && existingAlert.riskScore > 50) {
    signals.push({
      type:   "existing_fraud_alert",
      value:  existingAlert.riskScore,
      weight: Math.round(existingAlert.riskScore * 0.3),
    });
  }

  return signals;
}

// ── Alert upsert ──────────────────────────────────────────────

async function upsertFraudAlert(
  tenantId: string,
  riskScore: number,
  signals:   FraudSignal[]
): Promise<void> {
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
      data: {
        tenantId,
        riskScore,
        signals:  signals as any,
        status:   "NEW",
      },
    });
  }
}
