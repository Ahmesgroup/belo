// ============================================================
// infrastructure/providers/payment.provider.ts
// ABSTRACTION MULTI-PAYS — changer de provider = 0 impact métier
//
// Providers supportés :
//   Phase 1 : Wave (SN), Orange Money (SN)
//   Phase 2 : Stripe (Europe), MTN Money (CI)
//   Phase 3 : Paystack (NG)
// ============================================================

import { env } from "@/config/env";
import { AppError } from "@/shared/errors";

// ── TYPES ─────────────────────────────────────────────────────

export type SupportedProvider =
  | "wave"
  | "orange_money"
  | "stripe"
  | "mtn_money"
  | "paystack";

export interface PaymentInitParams {
  provider: SupportedProvider;
  amountCents: number;
  currency: string;          // "XOF" | "EUR" | "NGN"
  reference: string;         // bookingId ou idempotencyKey
  phone?: string;            // Wave / Orange Money
  redirectUrl?: string;      // Stripe
  metadata?: Record<string, string>;
}

export interface PaymentInitResult {
  provider: SupportedProvider;
  reference: string;
  checkoutUrl?: string;      // URL de paiement (Stripe, Wave web)
  ussdCode?: string;         // Code USSD Orange Money
  providerRef: string;       // ID côté provider
  status: "pending" | "initiated";
  expiresAt?: Date;
}

export interface PaymentVerifyResult {
  providerRef: string;
  status: "paid" | "pending" | "failed" | "expired";
  amountCents: number;
  currency: string;
  paidAt?: Date;
  metadata?: Record<string, unknown>;
}

// ── INTERFACE COMMUNE ──────────────────────────────────────────
// Chaque provider implémente cette interface
// Le service ne connaît QUE cette interface — jamais le provider direct

interface PaymentAdapter {
  init(params: PaymentInitParams): Promise<PaymentInitResult>;
  verify(providerRef: string): Promise<PaymentVerifyResult>;
  refund(providerRef: string, amountCents: number): Promise<void>;
}

// ── WAVE ADAPTER (Sénégal) ────────────────────────────────────

class WaveAdapter implements PaymentAdapter {
  private apiKey: string;
  private baseUrl = "https://api.wave.com/v1";

  constructor() {
    if (!env.WAVE_API_KEY) throw new AppError("CONFIG_ERROR", "Wave API key manquante.");
    this.apiKey = env.WAVE_API_KEY;
  }

  async init(params: PaymentInitParams): Promise<PaymentInitResult> {
    // Wave: créer un lien de paiement
    const res = await fetch(`${this.baseUrl}/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: params.amountCents, // Wave travaille en entiers XOF
        currency: "XOF",
        error_url: `${env.NEXT_PUBLIC_APP_URL}/booking/error`,
        success_url: `${env.NEXT_PUBLIC_APP_URL}/booking/success?ref=${params.reference}`,
        client_reference: params.reference,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new AppError("WAVE_ERROR", `Wave: ${err.message ?? "Erreur inconnue"}`);
    }

    const data = await res.json();

    return {
      provider: "wave",
      reference: params.reference,
      checkoutUrl: data.wave_launch_url,
      providerRef: data.id,
      status: "initiated",
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30min
    };
  }

  async verify(providerRef: string): Promise<PaymentVerifyResult> {
    const res = await fetch(`${this.baseUrl}/checkout/sessions/${providerRef}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!res.ok) throw new AppError("WAVE_ERROR", "Impossible de vérifier le paiement Wave.");

    const data = await res.json();

    return {
      providerRef: data.id,
      status: data.payment_status === "succeeded" ? "paid" : "pending",
      amountCents: data.amount,
      currency: "XOF",
      paidAt: data.payment_status === "succeeded" ? new Date(data.last_payment_date) : undefined,
    };
  }

  async refund(providerRef: string, amountCents: number): Promise<void> {
    // Wave ne supporte pas encore les remboursements automatiques
    // → log + notification manuelle admin
    console.warn(`[Wave] Remboursement manuel requis: ${providerRef} - ${amountCents} XOF`);
  }
}

// ── ORANGE MONEY ADAPTER (Sénégal) ───────────────────────────

class OrangeMoneyAdapter implements PaymentAdapter {
  private apiKey: string;
  private merchantId: string;
  private baseUrl = "https://api.orange.com/orange-money-webpay/dev/v1";

  constructor() {
    if (!env.ORANGE_API_KEY || !env.ORANGE_MERCHANT_ID) {
      throw new AppError("CONFIG_ERROR", "Orange Money config manquante.");
    }
    this.apiKey = env.ORANGE_API_KEY;
    this.merchantId = env.ORANGE_MERCHANT_ID;
  }

  async init(params: PaymentInitParams): Promise<PaymentInitResult> {
    const res = await fetch(`${this.baseUrl}/webpayment`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        merchant_key: this.merchantId,
        currency: "OUV",
        order_id: params.reference,
        amount: params.amountCents,
        return_url: `${env.NEXT_PUBLIC_APP_URL}/booking/success`,
        cancel_url: `${env.NEXT_PUBLIC_APP_URL}/booking/cancel`,
        notif_url: `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/orange-money`,
        lang: "fr",
      }),
    });

    if (!res.ok) throw new AppError("ORANGE_ERROR", "Erreur Orange Money.");
    const data = await res.json();

    return {
      provider: "orange_money",
      reference: params.reference,
      checkoutUrl: data.payment_url,
      providerRef: data.pay_token,
      status: "initiated",
    };
  }

  async verify(providerRef: string): Promise<PaymentVerifyResult> {
    const res = await fetch(`${this.baseUrl}/transactionstatus`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ order_id: providerRef }),
    });

    if (!res.ok) throw new AppError("ORANGE_ERROR", "Vérification paiement échouée.");
    const data = await res.json();

    return {
      providerRef,
      status: data.status === "SUCCESS" ? "paid" : "pending",
      amountCents: data.amount,
      currency: "XOF",
    };
  }

  async refund(_providerRef: string, _amountCents: number): Promise<void> {
    console.warn(`[OrangeMoney] Remboursement manuel requis.`);
  }
}

// ── STRIPE ADAPTER (Europe) ───────────────────────────────────

class StripeAdapter implements PaymentAdapter {
  async init(params: PaymentInitParams): Promise<PaymentInitResult> {
    if (!env.STRIPE_SECRET_KEY) throw new AppError("CONFIG_ERROR", "Stripe key manquante.");

    // Utiliser l'API Stripe directement (pas le SDK pour garder léger)
    const body = new URLSearchParams({
      "payment_method_types[]": "card",
      "line_items[0][price_data][currency]": params.currency.toLowerCase(),
      "line_items[0][price_data][unit_amount]": String(params.amountCents),
      "line_items[0][price_data][product_data][name]": params.metadata?.serviceName ?? "Réservation",
      "line_items[0][quantity]": "1",
      mode: "payment",
      success_url: `${env.NEXT_PUBLIC_APP_URL}/booking/success?ref=${params.reference}`,
      cancel_url: `${env.NEXT_PUBLIC_APP_URL}/booking/cancel`,
      client_reference_id: params.reference,
    });

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!res.ok) {
      const err = await res.json();
      throw new AppError("STRIPE_ERROR", err.error?.message ?? "Erreur Stripe.");
    }

    const session = await res.json();

    return {
      provider: "stripe",
      reference: params.reference,
      checkoutUrl: session.url,
      providerRef: session.id,
      status: "initiated",
      expiresAt: new Date(session.expires_at * 1000),
    };
  }

  async verify(providerRef: string): Promise<PaymentVerifyResult> {
    if (!env.STRIPE_SECRET_KEY) throw new AppError("CONFIG_ERROR", "Stripe key manquante.");

    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${providerRef}`, {
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
    });

    if (!res.ok) throw new AppError("STRIPE_ERROR", "Vérification Stripe échouée.");
    const session = await res.json();

    return {
      providerRef,
      status: session.payment_status === "paid" ? "paid" : "pending",
      amountCents: session.amount_total,
      currency: session.currency.toUpperCase(),
      paidAt: session.payment_status === "paid" ? new Date() : undefined,
    };
  }

  async refund(providerRef: string, amountCents: number): Promise<void> {
    if (!env.STRIPE_SECRET_KEY) return;
    await fetch("https://api.stripe.com/v1/refunds", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        payment_intent: providerRef,
        amount: String(amountCents),
      }),
    });
  }
}

// ── FACTORY — sélectionner le bon adapter ─────────────────────

const adapters: Partial<Record<SupportedProvider, PaymentAdapter>> = {};

export function getPaymentAdapter(provider: SupportedProvider): PaymentAdapter {
  // Lazy init — ne créer l'adapter que si nécessaire
  if (!adapters[provider]) {
    switch (provider) {
      case "wave":         adapters[provider] = new WaveAdapter();        break;
      case "orange_money": adapters[provider] = new OrangeMoneyAdapter(); break;
      case "stripe":       adapters[provider] = new StripeAdapter();      break;
      default:
        throw new AppError("UNSUPPORTED_PROVIDER", `Provider ${provider} non supporté.`);
    }
  }
  return adapters[provider]!;
}

// ── API PUBLIQUE du payment service ───────────────────────────

export async function initiatePayment(params: PaymentInitParams): Promise<PaymentInitResult> {
  const adapter = getPaymentAdapter(params.provider);
  return adapter.init(params);
}

export async function verifyPayment(
  provider: SupportedProvider,
  providerRef: string
): Promise<PaymentVerifyResult> {
  const adapter = getPaymentAdapter(provider);
  return adapter.verify(providerRef);
}

export async function refundPayment(
  provider: SupportedProvider,
  providerRef: string,
  amountCents: number
): Promise<void> {
  const adapter = getPaymentAdapter(provider);
  return adapter.refund(providerRef, amountCents);
}
