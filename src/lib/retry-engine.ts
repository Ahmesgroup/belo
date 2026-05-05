// ============================================================
// lib/retry-engine.ts — Retry exponentiel + Dead Letter Queue
//
// Strategy : Full Jitter (AWS blog 2015)
//   delay = random(0, min(maxDelay, base × 2^attempt))
// Avantages vs backoff fixe : évite la synchronisation des retries
//   quand plusieurs workers tentent la même opération.
//
// DLQ : stocké dans AuditLog (table existante, pas de migration).
// Les jobs DLQ sont consultables via le panel admin (vue Logs).
// ============================================================

import { prisma } from "@/infrastructure/db/prisma";

// ── TYPES ─────────────────────────────────────────────────────

export interface RetryOptions {
  maxAttempts?: number;  // défaut : 3
  baseDelayMs?: number;  // défaut : 100 ms
  maxDelayMs?:  number;  // défaut : 5 000 ms
  onRetry?:     (attempt: number, error: Error) => void;
}

interface DLQJob {
  type:     string;
  payload:  Record<string, unknown>;
  error:    string;
  attempts: number;
}

// ── RETRY ─────────────────────────────────────────────────────

export async function withRetry<T>(
  fn:      () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 100,
    maxDelayMs  = 5_000,
    onRetry,
  } = options;

  let lastError: Error = new Error("Unknown error");

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (raw) {
      lastError = raw instanceof Error ? raw : new Error(String(raw));

      if (attempt === maxAttempts) break;

      // Full Jitter : delay ∈ [0, min(maxDelay, base × 2^attempt)]
      const cap   = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
      const delay = Math.floor(Math.random() * cap);

      onRetry?.(attempt, lastError);
      await new Promise<void>((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}

// ── DEAD LETTER QUEUE ─────────────────────────────────────────
// Les jobs persistés dans AuditLog sont consultables via le
// panel admin (vue Logs, filter action="dlq:*").

export async function sendToDLQ(job: DLQJob): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action:   `dlq:${job.type}`,
      entity:   "DLQ",
      entityId: `${job.type}:${Date.now()}`,
      // Serialise payload to string so all fields are InputJsonValue-compatible
      newValue: {
        payload:  JSON.stringify(job.payload),
        error:    job.error,
        attempts: job.attempts,
        failedAt: new Date().toISOString(),
      },
    },
  }).catch((err: unknown) => {
    // La DLQ ne doit jamais crasher l'application
    console.error("[DLQ] Failed to persist failed job:", err);
  });
}

// ── RETRY + AUTO-DLQ ──────────────────────────────────────────

export async function withRetryAndDLQ<T>(
  jobType: string,
  payload: Record<string, unknown>,
  fn:      () => Promise<T>,
  options: RetryOptions = {},
): Promise<T | null> {
  const maxAttempts = options.maxAttempts ?? 3;
  let   lastAttempt = 0;

  try {
    return await withRetry(fn, {
      ...options,
      maxAttempts,
      onRetry: (attempt, err) => {
        lastAttempt = attempt;
        console.warn(
          `[Retry] ${jobType} attempt ${attempt}/${maxAttempts}: ${err.message}`,
        );
        options.onRetry?.(attempt, err);
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await sendToDLQ({
      type:     jobType,
      payload,
      error:    message,
      attempts: lastAttempt + 1,
    });
    return null;
  }
}
