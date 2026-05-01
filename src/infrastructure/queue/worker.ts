// ============================================================
// infrastructure/queue/worker.ts
// WORKER NOTIFICATIONS — Outbox Pattern avec SKIP LOCKED
//
// Principe :
//   1. Toutes les 30s, le cron appelle processNotificationBatch()
//   2. On claim N jobs PENDING avec FOR UPDATE SKIP LOCKED
//      → plusieurs workers peuvent tourner sans conflit
//   3. Pour chaque job : envoyer WhatsApp, mettre à jour statut
//   4. Max 3 tentatives → ensuite status = FAILED
//   5. Jobs SENT depuis +7j → archivés par archiveOldNotifs()
//
// Coût DB minimal :
//   • SKIP LOCKED = 0 contention entre workers
//   • Batch de 20 = 1 requête pour N envois
//   • Archive régulière = table légère
// ============================================================

import { prisma } from "@/infrastructure/db/prisma";
import { NotifStatus } from "@prisma/client";
import { env } from "@/config/env";

// ── CONFIG ────────────────────────────────────────────────────

const BATCH_SIZE = env.WORKER_BATCH_SIZE;      // défaut: 20
const MAX_ATTEMPTS = 3;
const LOCK_DURATION_MS = 5 * 60 * 1000;        // 5 minutes

// ── MAIN WORKER ───────────────────────────────────────────────

export async function processNotificationBatch(): Promise<void> {
  const startedAt = Date.now();
  let processed = 0;
  let sent = 0;
  let failed = 0;

  try {
    // ── 1. CLAIM les jobs avec SKIP LOCKED ───────────────────
    // FOR UPDATE SKIP LOCKED = skip les rows déjà lockées par
    // un autre worker → zéro contention, zéro deadlock
    const jobs = await prisma.$queryRaw<
      Array<{
        id: string;
        tenantId: string;
        bookingId: string | null;
        type: string;
        recipient: string;
        channel: string;
        payload: unknown;
        attempts: number;
        idempotencyKey: string;
      }>
    >`
      UPDATE "NotificationLog"
      SET
        status = 'PROCESSING',
        "lockedAt" = NOW(),
        "lockedUntil" = NOW() + INTERVAL '5 minutes',
        "updatedAt" = NOW()
      WHERE id IN (
        SELECT id FROM "NotificationLog"
        WHERE
          status = 'PENDING'
          AND attempts < ${MAX_ATTEMPTS}
          AND (
            "lockedUntil" IS NULL
            OR "lockedUntil" < NOW()
          )
        ORDER BY "createdAt" ASC
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING
        id, "tenantId", "bookingId", type, recipient,
        channel, payload, attempts, "idempotencyKey"
    `;

    if (jobs.length === 0) return; // rien à traiter

    processed = jobs.length;

    // ── 2. TRAITER chaque job en parallèle (par petits groupes) ──
    // Traitement par groupes de 5 pour éviter de surcharger
    // le provider WhatsApp (rate limit)
    const chunks = chunkArray(jobs, 5);

    for (const chunk of chunks) {
      await Promise.allSettled(
        chunk.map(async (job) => {
          try {
            await sendNotification(job);

            // Marquer comme SENT
            await prisma.notificationLog.update({
              where: { id: job.id },
              data: {
                status: NotifStatus.SENT,
                lockedAt: null,
                lockedUntil: null,
                lastAttemptAt: new Date(),
                attempts: { increment: 1 },
              },
            });

            sent++;
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            const newAttempts = job.attempts + 1;
            const isFinalAttempt = newAttempts >= MAX_ATTEMPTS;

            // Remettre en PENDING ou passer en FAILED
            await prisma.notificationLog.update({
              where: { id: job.id },
              data: {
                status: isFinalAttempt ? NotifStatus.FAILED : NotifStatus.PENDING,
                attempts: { increment: 1 },
                lastAttemptAt: new Date(),
                lockedAt: null,
                lockedUntil: null,
                errorMsg: errorMsg.slice(0, 500), // tronquer pour DB
              },
            });

            failed++;
            console.error(`[Worker] Job ${job.id} échoué (tentative ${newAttempts}/${MAX_ATTEMPTS}): ${errorMsg}`);
          }
        })
      );
    }

    const duration = Date.now() - startedAt;
    console.log(
      `[Worker] Batch terminé — ${processed} traités, ${sent} envoyés, ${failed} échoués (${duration}ms)`
    );
  } catch (err) {
    console.error("[Worker] Erreur critique du batch:", err);
    // Ne pas lancer l'erreur — le cron reprend au prochain cycle
  }
}

// ── SEND NOTIFICATION ─────────────────────────────────────────

async function sendNotification(job: {
  id: string;
  channel: string;
  recipient: string;
  payload: unknown;
  idempotencyKey: string;
}): Promise<void> {
  const payload = job.payload as { phone?: string; message?: string };

  switch (job.channel) {
    case "whatsapp":
      await sendWhatsApp({
        to: job.recipient,
        message: payload.message ?? "",
        idempotencyKey: job.idempotencyKey,
      });
      break;

    case "sms":
      await sendSMS({ to: job.recipient, message: payload.message ?? "" });
      break;

    case "email":
      await sendEmail(payload as { to: string; subject: string; html: string });
      break;

    default:
      throw new Error(`Canal inconnu: ${job.channel}`);
  }
}

// ── WHATSAPP SENDER ───────────────────────────────────────────

async function sendWhatsApp(params: {
  to: string;
  message: string;
  idempotencyKey: string;
}): Promise<void> {
  if (env.WHATSAPP_PROVIDER === "meta") {
    await sendWhatsAppMeta(params);
  } else {
    await sendWhatsAppTwilio(params);
  }
}

async function sendWhatsAppMeta(params: {
  to: string;
  message: string;
  idempotencyKey: string;
}): Promise<void> {
  if (!env.WHATSAPP_PHONE_ID || !env.WHATSAPP_TOKEN) {
    throw new Error("WhatsApp Meta config manquante.");
  }

  // Normaliser le numéro (+221 77... → 221 77...)
  const to = params.to.replace(/^\+/, "");

  const res = await fetch(
    `https://graph.facebook.com/v18.0/${env.WHATSAPP_PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: params.message },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`WhatsApp Meta error: ${JSON.stringify(err.error ?? err)}`);
  }
}

async function sendWhatsAppTwilio(params: {
  to: string;
  message: string;
}): Promise<void> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_WHATSAPP_FROM) {
    throw new Error("Twilio config manquante.");
  }

  const body = new URLSearchParams({
    From: `whatsapp:${env.TWILIO_WHATSAPP_FROM}`,
    To: `whatsapp:${params.to}`,
    Body: params.message,
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`
        ).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Twilio error: ${err.message}`);
  }
}

async function sendSMS(params: { to: string; message: string }): Promise<void> {
  // Placeholder — implémenter avec le provider SMS local (ex: Infobip)
  console.log(`[SMS] → ${params.to}: ${params.message.slice(0, 50)}...`);
}

async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.warn("[Email] Resend non configuré — email ignoré.");
    return;
  }

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
    }),
  });
}

// ── ARCHIVE (garder la table légère) ─────────────────────────
// À appeler par un cron quotidien (ex: chaque nuit à 2h)

export async function archiveOldNotifications(): Promise<void> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const result = await prisma.notificationLog.updateMany({
    where: {
      status: { in: [NotifStatus.SENT, NotifStatus.FAILED] },
      updatedAt: { lt: sevenDaysAgo },
    },
    data: { status: NotifStatus.ARCHIVED },
  });

  if (result.count > 0) {
    console.log(`[Archive] ${result.count} notifications archivées.`);
  }
}

// ── UTILS ─────────────────────────────────────────────────────

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}


// ============================================================
// lib/idempotency.ts
// Génération et vérification des clés d'idempotency
// ============================================================

export function generateIdempotencyKey(): string {
  // UUID v4 simple sans dépendance
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function buildNotifIdempotencyKey(
  bookingId: string,
  recipient: "client" | "owner",
  type: string
): string {
  return `${bookingId}:${recipient}:${type}`;
}


// ============================================================
// shared/errors.ts
// Erreurs typées — jamais de throw Error("message") brut
// ============================================================

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = "AppError";
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
      },
    };
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id?: string) {
    super(
      `${entity.toUpperCase()}_NOT_FOUND`,
      `${entity}${id ? ` (${id})` : ""} introuvable.`,
      404
    );
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Non autorisé.") {
    super("UNAUTHORIZED", message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Accès refusé.") {
    super("FORBIDDEN", message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super("CONFLICT", message, 409);
  }
}


// ============================================================
// infrastructure/cron/worker.cron.ts
// Démarrage du cron worker (Next.js ou standalone Node)
// ============================================================

// Pour Next.js : créer app/api/cron/notifications/route.ts
// et appeler processNotificationBatch() depuis là
// Vercel Cron Jobs = gratuit jusqu'à 1 exec/jour en free tier
// Pour plus de fréquence : Render.com (gratuit) ou Railway

export function startWorkerCron(): void {
  const interval = env.WORKER_INTERVAL_MS; // défaut 30s

  console.log(`[Cron] Worker démarré — toutes les ${interval / 1000}s`);

  // Premier run immédiat
  processNotificationBatch().catch(console.error);

  // Puis toutes les N secondes
  setInterval(() => {
    processNotificationBatch().catch(console.error);
  }, interval);

  // Archive quotidienne (simulation — en prod : cron séparé à 2h du matin)
  setInterval(
    () => {
      archiveOldNotifications().catch(console.error);
    },
    24 * 60 * 60 * 1000 // toutes les 24h
  );
}
