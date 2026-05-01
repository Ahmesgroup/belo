// ============================================================
// app/api/webhooks/route.ts — VERSION CORRIGÉE
// CORRECTION CRITIQUE : signature Stripe réelle (pas le stub)
// + Fix booking counter (jamais décrémenter, reset mensuel)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/db/prisma";
import { env } from "@/config/env";

export async function POST(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get("provider");
  const rawBody  = await req.text();

  switch (provider) {
    case "wave":   return handleWave(req, rawBody);
    case "stripe": return handleStripe(req, rawBody);
    case "orange": return handleOrange(req, rawBody);
    default:
      return NextResponse.json({ received: true }, { status: 200 });
  }
}

// ── WAVE ──────────────────────────────────────────────────────

async function handleWave(req: NextRequest, rawBody: string) {
  const signature = req.headers.get("wave-signature") ?? "";
  const isValid   = await verifyHmacSignature(rawBody, signature, env.WAVE_WEBHOOK_SECRET ?? "");
  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  processWaveEvent(rawBody).catch((e) => console.error("[Webhook/Wave]", e));
  return NextResponse.json({ received: true });
}

async function processWaveEvent(rawBody: string) {
  const event = JSON.parse(rawBody);
  if (event.type !== "checkout.session.completed") return;
  const ref = event.data?.client_reference;
  if (!ref) return;
  await confirmPayment(ref, event.data?.id, "WAVE");
}

// ── STRIPE (CORRIGÉ — vraie vérification HMAC) ───────────────

async function handleStripe(req: NextRequest, rawBody: string) {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Not configured" }, { status: 400 });
  }

  const signature = req.headers.get("stripe-signature") ?? "";

  // ✅ CORRECTION : vraie vérification HMAC-SHA256 Stripe
  const isValid = await verifyStripeSignature(
    rawBody,
    signature,
    env.STRIPE_WEBHOOK_SECRET
  );

  if (!isValid) {
    console.warn("[Webhook/Stripe] Signature invalide — requête rejetée");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  processStripeEvent(rawBody).catch((e) => console.error("[Webhook/Stripe]", e));
  return NextResponse.json({ received: true });
}

// ✅ Vraie vérification HMAC-SHA256 Stripe
// Stripe format: "t=TIMESTAMP,v1=HMAC_SIGNATURE"
// Signed payload: "TIMESTAMP.RAW_BODY"
async function verifyStripeSignature(
  payload: string,
  header:  string,
  secret:  string
): Promise<boolean> {
  if (!header || !secret) return false;

  try {
    // Parser le header Stripe
    const parts: Record<string, string> = {};
    for (const part of header.split(",")) {
      const [key, value] = part.split("=");
      if (key && value) parts[key.trim()] = value.trim();
    }

    const timestamp = parts["t"];
    const v1        = parts["v1"];
    if (!timestamp || !v1) return false;

    // Protection anti-replay : rejeter si > 5 minutes
    const timeDiff = Math.abs(Date.now() / 1000 - parseInt(timestamp));
    if (timeDiff > 300) {
      console.warn(`[Webhook/Stripe] Timestamp trop ancien: ${timeDiff}s`);
      return false;
    }

    // Construire le signed_payload exactement comme Stripe
    // Format : "timestamp.raw_body"
    const signedPayload = `${timestamp}.${payload}`;

    // HMAC-SHA256 avec Web Crypto API (edge-compatible)
    const encoder    = new TextEncoder();
    const keyData    = encoder.encode(secret);
    const msgData    = encoder.encode(signedPayload);

    const cryptoKey  = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const sigBuffer  = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
    const computed   = Array.from(new Uint8Array(sigBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Comparaison en temps constant (protection timing attack)
    return timingSafeEqual(computed, v1);
  } catch (err) {
    console.error("[Webhook/Stripe] Erreur vérification signature:", err);
    return false;
  }
}

async function processStripeEvent(rawBody: string) {
  const event = JSON.parse(rawBody);
  if (event.type !== "checkout.session.completed") return;
  const ref = event.data?.object?.client_reference_id;
  if (!ref) return;
  await confirmPayment(ref, event.data?.object?.payment_intent, "STRIPE");
}

// ── ORANGE MONEY ──────────────────────────────────────────────

async function handleOrange(req: NextRequest, rawBody: string) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token || token !== env.ORANGE_API_KEY) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
  processOrangeEvent(rawBody).catch((e) => console.error("[Webhook/Orange]", e));
  return NextResponse.json({ received: true });
}

async function processOrangeEvent(rawBody: string) {
  const event = JSON.parse(rawBody);
  if (event.status !== "SUCCESS") return;
  const ref = event.order_id;
  if (!ref) return;
  await confirmPayment(ref, event.pay_token, "ORANGE_MONEY");
}

// ── CONFIRM PAYMENT — partagé par tous les providers ─────────
// ✅ Idempotent — plusieurs appels = même résultat

async function confirmPayment(
  idempotencyKey: string,
  paymentRef:     string | undefined,
  provider:       "WAVE" | "STRIPE" | "ORANGE_MONEY"
) {
  const booking = await prisma.booking.findFirst({
    where: {
      OR: [
        { idempotencyKey },
        { id: idempotencyKey },
      ],
    },
    select: {
      id:            true,
      tenantId:      true,
      paymentStatus: true,
      depositCents:  true,
      priceCents:    true,
    },
  });

  if (!booking) {
    console.error(`[confirmPayment] Booking introuvable pour ref: ${idempotencyKey}`);
    return;
  }

  // Idempotent — déjà confirmé = skip
  if (booking.paymentStatus === "PAID") {
    console.log(`[confirmPayment] Booking ${booking.id} déjà payé — skip`);
    return;
  }

  // Déterminer si c'est un acompte ou le total
  const isDeposit = booking.depositCents > 0;
  const newStatus = isDeposit ? "DEPOSIT_PAID" : "PAID";

  await prisma.$transaction(async (tx) => {
    // Mettre à jour le booking
    await tx.booking.update({
      where: { id: booking.id },
      data: {
        paymentStatus:   newStatus as any,
        paymentProvider: provider as any,
        paymentRef:      paymentRef ?? null,
        status:          "CONFIRMED",
      },
    });

    // ✅ FIX CRITIQUE : ne jamais modifier bookingsThisMonth ici
    // Le compteur est incrémenté à la CRÉATION (non au paiement)
    // et JAMAIS décrémenté (même si annulation)
    // Reset mensuel géré par le cron purge-logs

    // Créer les notifications dans l'outbox
    await tx.notificationLog.createMany({
      data: [
        // Notification client
        {
          tenantId:  booking.tenantId,
          bookingId: booking.id,
          channel:   "WHATSAPP",
          status:    "PENDING",
          payload: {
            type:    "booking_confirmed_client",
            message: `✅ Votre réservation est confirmée ! Paiement reçu via ${provider}. Rendez-vous confirmé.`,
          },
        },
        // Notification gérant
        {
          tenantId:  booking.tenantId,
          bookingId: booking.id,
          channel:   "WHATSAPP",
          status:    "PENDING",
          payload: {
            type:    "booking_confirmed_owner",
            message: `💰 Paiement reçu ! Nouvelle réservation confirmée. Ref: ${paymentRef ?? idempotencyKey}.`,
          },
        },
      ],
    });
  });

  console.log(`[confirmPayment] Booking ${booking.id} confirmé — ${provider} — ${newStatus}`);
}

// ── HELPERS ───────────────────────────────────────────────────

async function verifyHmacSignature(
  payload:   string,
  signature: string,
  secret:    string
): Promise<boolean> {
  if (!secret || !signature) return false;

  try {
    const encoder  = new TextEncoder();
    const key      = await crypto.subtle.importKey(
      "raw", encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false, ["sign"]
    );
    const sigBuf   = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const computed = Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return timingSafeEqual(computed, signature.replace("sha256=", ""));
  } catch {
    return false;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}


// ============================================================
// FIX booking counter — à intégrer dans booking.service.ts
//
// ✅ NE PAS décrémenter bookingsThisMonth à l'annulation
// Le compteur = bookings créés ce mois (high-water mark)
// Reset mensuel dans le cron purge-logs
// ============================================================

/*
// Dans booking.service.ts — cancelBooking()
// SUPPRIMER ce code :
// await tx.tenant.update({
//   where: { id: booking.tenantId },
//   data:  { bookingsThisMonth: { decrement: 1 } },  // ← SUPPRIMER
// });

// Dans purge-logs/route.ts — ajouter le reset mensuel :
const now = new Date();
const isFirstDayOfMonth = now.getDate() === 1;
if (isFirstDayOfMonth) {
  await prisma.tenant.updateMany({
    data: { bookingsThisMonth: 0, lastQuotaReset: now },
  });
  console.log("[Cron/Purge] Quota mensuel réinitialisé pour tous les tenants");
}
*/
