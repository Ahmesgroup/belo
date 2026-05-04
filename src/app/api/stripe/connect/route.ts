// POST /api/stripe/connect
// Creates a Stripe Express account for the tenant and returns the onboarding URL.
// The salon owner is redirected there; on completion Stripe calls the webhook.

import { NextRequest, NextResponse } from "next/server";
import { prisma }         from "@/infrastructure/db/prisma";
import { withAuth }       from "@/lib/route-auth";
import { handleRouteError, AppErrors } from "@/shared/errors";
import { env }            from "@/config/env";

const STRIPE_BASE = "https://api.stripe.com/v1";

async function stripePost(path: string, body: Record<string, string>): Promise<Response> {
  return fetch(`${STRIPE_BASE}${path}`, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const auth = await withAuth(req);
    if (!auth.ok) return NextResponse.json(AppErrors.UNAUTHORIZED().toJSON(), { status: 401 });

    const tenant = await prisma.tenant.findFirst({
      where:  { users: { some: { id: auth.userId } }, deletedAt: null },
      select: { id: true, name: true, email: true, stripeAccountId: true, stripeOnboardingComplete: true },
    });

    if (!tenant) return NextResponse.json(AppErrors.TENANT_NOT_FOUND().toJSON(), { status: 404 });

    const appUrl = env.NEXT_PUBLIC_APP_URL;

    // Reuse existing account if already created
    let accountId = tenant.stripeAccountId;

    if (!accountId) {
      const res = await stripePost("/accounts", {
        type:                    "express",
        "capabilities[card_payments][requested]": "true",
        "capabilities[transfers][requested]":     "true",
        ...(tenant.email ? { email: tenant.email } : {}),
        "business_type":         "individual",
        "metadata[tenantId]":    tenant.id,
        "metadata[tenantName]":  tenant.name,
      });

      if (!res.ok) {
        const err = await res.json();
        console.error("[Stripe/Connect] account create failed:", err);
        return NextResponse.json({ error: { code: "STRIPE_ERROR", message: "Stripe account creation failed." } }, { status: 502 });
      }

      const account = await res.json();
      accountId = account.id as string;

      await prisma.tenant.update({
        where: { id: tenant.id },
        data:  { stripeAccountId: accountId },
      });
    }

    // Create onboarding link (expires in ~10 min)
    const linkRes = await stripePost("/account_links", {
      account:     accountId,
      refresh_url: `${appUrl}/dashboard/stripe/refresh`,
      return_url:  `${appUrl}/dashboard/stripe/success`,
      type:        "account_onboarding",
    });

    if (!linkRes.ok) {
      const err = await linkRes.json();
      console.error("[Stripe/Connect] account_links failed:", err);
      return NextResponse.json({ error: { code: "STRIPE_ERROR", message: "Failed to generate onboarding link." } }, { status: 502 });
    }

    const link = await linkRes.json();

    return NextResponse.json({ data: { url: link.url as string, accountId } });
  } catch (err) {
    return handleRouteError(err);
  }
}

// GET /api/stripe/connect — check onboarding status
export async function GET(req: NextRequest) {
  try {
    const auth = await withAuth(req);
    if (!auth.ok) return NextResponse.json(AppErrors.UNAUTHORIZED().toJSON(), { status: 401 });

    const tenant = await prisma.tenant.findFirst({
      where:  { users: { some: { id: auth.userId } }, deletedAt: null },
      select: { id: true, stripeAccountId: true, stripeOnboardingComplete: true },
    });

    if (!tenant) return NextResponse.json(AppErrors.TENANT_NOT_FOUND().toJSON(), { status: 404 });

    if (!tenant.stripeAccountId) {
      return NextResponse.json({ data: { connected: false, onboardingComplete: false } });
    }

    // Verify with Stripe
    const res = await fetch(`${STRIPE_BASE}/accounts/${tenant.stripeAccountId}`, {
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
    });

    if (!res.ok) {
      return NextResponse.json({ data: { connected: true, onboardingComplete: tenant.stripeOnboardingComplete } });
    }

    const account = await res.json();
    const complete = account.details_submitted === true && account.charges_enabled === true;

    if (complete && !tenant.stripeOnboardingComplete) {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data:  { stripeOnboardingComplete: true },
      });
    }

    return NextResponse.json({
      data: {
        connected:           true,
        onboardingComplete:  complete,
        chargesEnabled:      account.charges_enabled,
        payoutsEnabled:      account.payouts_enabled,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
