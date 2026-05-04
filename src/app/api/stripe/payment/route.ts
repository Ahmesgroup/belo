// POST /api/stripe/payment
// Creates a PaymentIntent with platform fee and transfer to the salon's Stripe account.
// Phase 1: Belo collects full amount. Phase 2: transfer to tenant on payout.

import { NextRequest, NextResponse } from "next/server";
import { z }              from "zod";
import { prisma }         from "@/infrastructure/db/prisma";
import { withAuth }       from "@/lib/route-auth";
import { handleRouteError, AppErrors } from "@/shared/errors";
import { getCommissionPercent } from "@/lib/settings";
import { env }            from "@/config/env";

const STRIPE_BASE = "https://api.stripe.com/v1";

const Schema = z.object({
  bookingId: z.string().min(1),
  returnUrl: z.string().url(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await withAuth(req);
    if (!auth.ok) return NextResponse.json(AppErrors.UNAUTHORIZED().toJSON(), { status: 401 });

    const body   = await req.json().catch(() => null);
    if (!body) return NextResponse.json(AppErrors.INVALID_JSON().toJSON(), { status: 400 });

    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", fields: parsed.error.flatten() } }, { status: 422 });
    }

    const { bookingId, returnUrl } = parsed.data;

    const booking = await prisma.booking.findUnique({
      where:  { id: bookingId },
      select: {
        id: true, userId: true, tenantId: true,
        priceCents: true, depositCents: true, currency: true,
        paymentStatus: true, stripePaymentIntentId: true,
        tenant: { select: { stripeAccountId: true, stripeOnboardingComplete: true } },
      },
    });

    if (!booking) return NextResponse.json(AppErrors.BOOKING_NOT_FOUND().toJSON(), { status: 404 });
    if (booking.userId !== auth.userId) return NextResponse.json(AppErrors.FORBIDDEN().toJSON(), { status: 403 });
    if (booking.paymentStatus === "PAID") {
      return NextResponse.json({ error: { code: "ALREADY_PAID" } }, { status: 409 });
    }

    const amountCents = booking.tenant.stripeOnboardingComplete && booking.depositCents > 0
      ? booking.depositCents
      : booking.priceCents;

    // Calculate platform fee
    const commissionPct  = await getCommissionPercent();
    const platformFeeCents = Math.round(amountCents * (commissionPct / 100));

    // Currency mapping: XOF → EUR for Stripe (min 50 cents EUR)
    const stripeCurrency = booking.currency === "XOF" ? "eur" : booking.currency.toLowerCase();
    const stripeAmount   = booking.currency === "XOF"
      ? Math.max(50, Math.round(amountCents / 655.957))  // 1 EUR ≈ 655.957 XOF
      : amountCents;
    const stripeFee = booking.currency === "XOF"
      ? Math.round(platformFeeCents / 655.957)
      : platformFeeCents;

    // Build PaymentIntent params
    const params: Record<string, string> = {
      amount:   String(stripeAmount),
      currency: stripeCurrency,
      "metadata[bookingId]":  bookingId,
      "metadata[tenantId]":   booking.tenantId,
      "automatic_payment_methods[enabled]": "true",
      "return_url": returnUrl,
    };

    // Add transfer if salon has a verified Stripe account (Phase 2+)
    if (booking.tenant.stripeAccountId && booking.tenant.stripeOnboardingComplete) {
      params["application_fee_amount"] = String(stripeFee);
      params["transfer_data[destination]"] = booking.tenant.stripeAccountId;
    }

    const res = await fetch(`${STRIPE_BASE}/payment_intents`, {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params).toString(),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error("[Stripe/Payment] PaymentIntent failed:", err);
      return NextResponse.json({ error: { code: "STRIPE_ERROR", message: "Payment initiation failed." } }, { status: 502 });
    }

    const intent = await res.json();

    // Persist to booking
    await prisma.booking.update({
      where: { id: bookingId },
      data:  {
        stripePaymentIntentId: intent.id,
        platformFeeCents:      platformFeeCents,
        paymentProvider:       "STRIPE",
        paymentRef:            intent.id,
      },
    });

    return NextResponse.json({
      data: {
        clientSecret:   intent.client_secret as string,
        paymentIntentId:intent.id as string,
        amountCents:    stripeAmount,
        currency:       stripeCurrency,
        platformFeeCents,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
