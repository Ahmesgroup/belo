// ============================================================
// app/api/payments/route.ts
// POST /api/payments/init      → initier une session de paiement
// GET  /api/payments/verify    → vérifier le statut
// POST /api/payments/refund    → rembourser (PREMIUM uniquement)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/infrastructure/db/prisma";
import { withAuth, withTenant } from "@/lib/route-auth";
import { zodErrorResponse } from "@/lib/zod-formatter";
import { handleRouteError, AppErrors } from "@/shared/errors";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/config/env";
import { getCorsHeaders } from "@/lib/cors";

// ── SCHEMAS ───────────────────────────────────────────────────

const InitPaymentSchema = z.object({
  bookingId:   z.string().min(1, "Réservation invalide"),
  provider:    z.enum(["wave", "orange_money", "stripe"]),
  returnUrl:   z.string().url("URL de retour invalide"),
  cancelUrl:   z.string().url().optional(),
});

const RefundSchema = z.object({
  bookingId: z.string().min(1),
  reason:    z.string().max(500).optional(),
});

// ── POST /api/payments/init ───────────────────────────────────
// Initier un paiement → retourner une URL de checkout

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "init";

    if (action === "init")   return handleInit(req);
    if (action === "refund") return handleRefund(req);

    return NextResponse.json(
      { error: { code: "UNKNOWN_ACTION", message: "Action non reconnue." } },
      { status: 400 }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

async function handleInit(req: NextRequest): Promise<NextResponse> {
  const limited = await rateLimit(req, { max: 10, windowMs: 60_000 });
  if (limited) return NextResponse.json(AppErrors.RATE_LIMITED().toJSON(), { status: 429 });

  const auth = await withAuth(req);
  if (!auth.ok) return NextResponse.json(AppErrors.UNAUTHORIZED().toJSON(), { status: 401 });

  const raw = await req.json().catch(() => null);
  if (!raw) return NextResponse.json(AppErrors.INVALID_JSON().toJSON(), { status: 400 });

  const parsed = InitPaymentSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(zodErrorResponse(parsed.error), { status: 422 });
  }

  const { bookingId, provider, returnUrl, cancelUrl } = parsed.data;

  // Récupérer le booking
  const booking = await prisma.booking.findUnique({
    where:  { id: bookingId },
    select: {
      id:             true,
      userId:         true,
      tenantId:       true,
      status:         true,
      paymentStatus:  true,
      priceCents:     true,
      depositCents:   true,
      currency:       true,
      idempotencyKey: true,
      service: { select: { name: true } },
      tenant:  { select: { name: true, depositEnabled: true, plan: true } },
    },
  });

  if (!booking) {
    return NextResponse.json(AppErrors.BOOKING_NOT_FOUND().toJSON(), { status: 404 });
  }

  // Vérifier que c'est bien le client du booking
  if (booking.userId !== auth.userId) {
    return NextResponse.json(AppErrors.FORBIDDEN().toJSON(), { status: 403 });
  }

  // Booking déjà payé ?
  if (booking.paymentStatus === "PAID") {
    return NextResponse.json(
      { error: { code: "ALREADY_PAID", message: "Cette réservation est déjà payée." } },
      { status: 409 }
    );
  }

  // Montant à payer : acompte si configuré, sinon total
  const amountCents =
    booking.tenant.depositEnabled && booking.depositCents > 0
      ? booking.depositCents
      : booking.priceCents;

  // Initier le paiement selon le provider
  let checkoutUrl: string;
  let paymentRef: string;

  switch (provider) {
    case "wave":
      ({ checkoutUrl, paymentRef } = await initWavePayment({
        amountCents,
        currency:  booking.currency,
        reference: booking.idempotencyKey,
        label:     `${booking.service.name} — ${booking.tenant.name}`,
        returnUrl,
        cancelUrl: cancelUrl ?? returnUrl,
      }));
      break;

    case "orange_money":
      ({ checkoutUrl, paymentRef } = await initOrangePayment({
        amountCents,
        currency:  booking.currency,
        reference: booking.idempotencyKey,
        returnUrl,
      }));
      break;

    case "stripe":
      ({ checkoutUrl, paymentRef } = await initStripePayment({
        amountCents,
        currency:  booking.currency.toLowerCase() === "xof" ? "eur" : booking.currency.toLowerCase(),
        reference: booking.idempotencyKey,
        label:     `${booking.service.name} — ${booking.tenant.name}`,
        returnUrl,
        cancelUrl: cancelUrl ?? returnUrl,
      }));
      break;

    default:
      return NextResponse.json(
        AppErrors.PAYMENT_NOT_CONFIGURED(provider).toJSON(),
        { status: 400 }
      );
  }

  // Mettre à jour le booking avec la référence de paiement
  await prisma.booking.update({
    where: { id: bookingId },
    data:  {
      paymentProvider: provider.toUpperCase() as any,
      paymentRef,
    },
  });

  return NextResponse.json({
    data: {
      checkoutUrl,
      paymentRef,
      amountCents,
      currency: booking.currency,
      provider,
    },
  }, { headers: getCorsHeaders(req) });
}

async function handleRefund(req: NextRequest): Promise<NextResponse> {
  const auth = await withAuth(req);
  if (!auth.ok) return NextResponse.json(AppErrors.UNAUTHORIZED().toJSON(), { status: 401 });

  const raw = await req.json().catch(() => null);
  if (!raw) return NextResponse.json(AppErrors.INVALID_JSON().toJSON(), { status: 400 });

  const parsed = RefundSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(zodErrorResponse(parsed.error), { status: 422 });
  }

  const booking = await prisma.booking.findUnique({
    where:  { id: parsed.data.bookingId },
    select: {
      id:             true,
      tenantId:       true,
      paymentStatus:  true,
      paymentRef:     true,
      paymentProvider: true,
      priceCents:     true,
      tenant: { select: { plan: true } },
    },
  });

  if (!booking) {
    return NextResponse.json(AppErrors.BOOKING_NOT_FOUND().toJSON(), { status: 404 });
  }

  // Remboursement auto = PREMIUM uniquement
  if (booking.tenant.plan !== "PREMIUM") {
    return NextResponse.json(
      {
        error: {
          code: "PLAN_REQUIRED",
          message: "Le remboursement automatique est disponible en plan Premium uniquement.",
        },
      },
      { status: 403 }
    );
  }

  // Vérifier que le gérant du salon demande le remboursement
  const tenantCheck = await withTenant(auth, booking.tenantId);
  if (!tenantCheck.ok) return tenantCheck.response;

  if (booking.paymentStatus !== "PAID") {
    return NextResponse.json(
      { error: { code: "NOT_PAID", message: "Impossible de rembourser un paiement non effectué." } },
      { status: 400 }
    );
  }

  // Effectuer le remboursement selon le provider
  // (implementation simplifiée — en prod utiliser les SDK)
  await prisma.booking.update({
    where: { id: parsed.data.bookingId },
    data:  { paymentStatus: "REFUNDED" },
  });

  await prisma.auditLog.create({
    data: {
      action:   "booking.refunded",
      entity:   "Booking",
      entityId: parsed.data.bookingId,
      actorId:  auth.userId,
      newValue: { reason: parsed.data.reason, provider: booking.paymentProvider },
    },
  });

  return NextResponse.json({
    data: { refunded: true, bookingId: parsed.data.bookingId },
  });
}

// ── GET /api/payments/verify ──────────────────────────────────
// Vérifier le statut d'un paiement (polling côté client)

export async function GET(req: NextRequest) {
  try {
    const auth = await withAuth(req);
    if (!auth.ok) return NextResponse.json(AppErrors.UNAUTHORIZED().toJSON(), { status: 401 });

    const bookingId = new URL(req.url).searchParams.get("bookingId");
    if (!bookingId) {
      return NextResponse.json(
        { error: { code: "MISSING_PARAMS", message: "bookingId requis." } },
        { status: 400 }
      );
    }

    const booking = await prisma.booking.findUnique({
      where:  { id: bookingId },
      select: {
        id:            true,
        userId:        true,
        status:        true,
        paymentStatus: true,
        paymentRef:    true,
      },
    });

    if (!booking) {
      return NextResponse.json(AppErrors.BOOKING_NOT_FOUND().toJSON(), { status: 404 });
    }

    if (booking.userId !== auth.userId) {
      return NextResponse.json(AppErrors.FORBIDDEN().toJSON(), { status: 403 });
    }

    return NextResponse.json({
      data: {
        bookingId: booking.id,
        status:    booking.status,
        paymentStatus: booking.paymentStatus,
        isPaid: booking.paymentStatus === "PAID",
      },
    }, { headers: getCorsHeaders(req) });
  } catch (err) {
    return handleRouteError(err);
  }
}

export function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(req) });
}

// ── HELPERS PROVIDERS ─────────────────────────────────────────

async function initWavePayment(params: {
  amountCents: number;
  currency:    string;
  reference:   string;
  label:       string;
  returnUrl:   string;
  cancelUrl:   string;
}): Promise<{ checkoutUrl: string; paymentRef: string }> {
  if (!env.WAVE_API_KEY) {
    throw AppErrors.PAYMENT_NOT_CONFIGURED("Wave");
  }

  // Wave API — convertir centimes → unité monétaire
  const amount = params.amountCents / 100;

  const res = await fetch("https://api.wave.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.WAVE_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": params.reference,
    },
    body: JSON.stringify({
      amount:              String(amount),
      currency:            "XOF",
      client_reference:    params.reference,
      success_url:         params.returnUrl,
      error_url:           params.cancelUrl,
      payment_description: params.label,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw AppErrors.PAYMENT_FAILED(`Wave: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  return {
    checkoutUrl: data.wave_launch_url,
    paymentRef:  data.id,
  };
}

async function initOrangePayment(params: {
  amountCents: number;
  currency:    string;
  reference:   string;
  returnUrl:   string;
}): Promise<{ checkoutUrl: string; paymentRef: string }> {
  if (!env.ORANGE_API_KEY) {
    throw AppErrors.PAYMENT_NOT_CONFIGURED("Orange Money");
  }

  // Orange Money API simplifié
  const res = await fetch("https://api.orange.com/orange-money-webpay/sn/v1/webpayment", {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${env.ORANGE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      merchant_key:  env.ORANGE_MERCHANT_ID,
      currency:      "OUV",
      order_id:      params.reference,
      amount:        String(params.amountCents / 100),
      return_url:    params.returnUrl,
      cancel_url:    params.returnUrl,
      notif_url:     `${env.NEXT_PUBLIC_APP_URL}/api/webhooks?provider=orange&token=${env.ORANGE_API_KEY}`,
      lang:          "fr",
    }),
  });

  if (!res.ok) {
    throw AppErrors.PAYMENT_FAILED("Orange Money: erreur d'initialisation");
  }

  const data = await res.json();
  return {
    checkoutUrl: data.payment_url,
    paymentRef:  data.pay_token,
  };
}

async function initStripePayment(params: {
  amountCents: number;
  currency:    string;
  reference:   string;
  label:       string;
  returnUrl:   string;
  cancelUrl:   string;
}): Promise<{ checkoutUrl: string; paymentRef: string }> {
  if (!env.STRIPE_SECRET_KEY) {
    throw AppErrors.PAYMENT_NOT_CONFIGURED("Stripe");
  }

  // Stripe Checkout Session
  const body = new URLSearchParams({
    "payment_method_types[]":            "card",
    "line_items[0][price_data][currency]": params.currency,
    "line_items[0][price_data][unit_amount]": String(params.amountCents),
    "line_items[0][price_data][product_data][name]": params.label,
    "line_items[0][quantity]":           "1",
    "mode":                              "payment",
    "client_reference_id":               params.reference,
    "success_url":                       `${params.returnUrl}?payment=success`,
    "cancel_url":                        params.cancelUrl,
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": params.reference,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw AppErrors.PAYMENT_FAILED(`Stripe: ${(err as any)?.error?.message ?? "erreur"}`);
  }

  const session = await res.json();
  return {
    checkoutUrl: session.url,
    paymentRef:  session.id,
  };
}
