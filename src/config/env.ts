// ============================================================
// config/env.ts
// Validation Zod de toutes les variables d'environnement
// Fail FAST au démarrage si une var manque ou est invalide
// ============================================================

import { z } from "zod";

const envSchema = z.object({
  // ── NODE ──────────────────────────────────────────────────
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // ── DATABASE (Neon PostgreSQL) ────────────────────────────
  // Neon fournit 2 URLs :
  //   DATABASE_URL  → pooled (pour l'app, via pgBouncer)
  //   DIRECT_URL    → direct (pour les migrations Prisma)
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),

  // ── AUTH ──────────────────────────────────────────────────
  // Générer avec: openssl rand -base64 32
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("7d"),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default("30d"),

  // ── APP ───────────────────────────────────────────────────
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_APP_NAME: z.string().default("Belo"),

  // ── WHATSAPP (Twilio ou WhatsApp Cloud API) ───────────────
  // Utilise WhatsApp Cloud API Meta (gratuit jusqu'à 1000 conv/mois)
  WHATSAPP_PROVIDER: z.enum(["twilio", "meta"]).default("meta"),
  WHATSAPP_PHONE_ID: z.string().optional(),       // Meta Cloud API
  WHATSAPP_TOKEN: z.string().optional(),           // Meta Cloud API
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),

  // ── PAIEMENTS ─────────────────────────────────────────────
  // Wave (Sénégal)
  WAVE_API_KEY: z.string().optional(),
  WAVE_WEBHOOK_SECRET: z.string().optional(),

  // Orange Money (Sénégal)
  ORANGE_API_KEY: z.string().optional(),
  ORANGE_MERCHANT_ID: z.string().optional(),

  // Stripe (Europe - Phase 2)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),

  // Paystack (Nigeria - Phase 3)
  PAYSTACK_SECRET_KEY: z.string().optional(),

  // ── STOCKAGE FICHIERS ─────────────────────────────────────
  // Cloudflare R2 = compatible S3, gratuit jusqu'à 10 GB
  // Alternative: Supabase Storage (free 1GB)
  STORAGE_PROVIDER: z.enum(["r2", "supabase", "local"]).default("local"),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY: z.string().optional(),
  R2_SECRET_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  NEXT_PUBLIC_CDN_URL: z.string().url().optional(),

  // ── EMAIL (Resend — gratuit 3000 emails/mois) ─────────────
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().default("noreply@belo.sn"),

  // ── REDIS (optionnel Phase 1) ─────────────────────────────
  // Upstash Redis = serverless, gratuit 10k req/jour
  // Laisser vide en Phase 1 → PostgreSQL fait le job de queue
  REDIS_URL: z.string().url().optional(),

  // ── WORKER ────────────────────────────────────────────────
  // Intervalle du cron worker en ms (défaut: 30s)
  WORKER_INTERVAL_MS: z.coerce.number().default(30_000),
  WORKER_BATCH_SIZE: z.coerce.number().default(20),

  // ── RATE LIMITING ─────────────────────────────────────────
  // Requests max par fenêtre
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),

  // ── MONITORING (optionnel) ────────────────────────────────
  // Sentry gratuit jusqu'à 5k erreurs/mois
  SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
});

// ── VALIDATION ────────────────────────────────────────────────
// Lance une erreur claire au démarrage si une var est invalide
const _parsed = envSchema.safeParse(process.env);

if (!_parsed.success) {
  console.error("❌ Variables d'environnement invalides :");
  console.error(
    JSON.stringify(_parsed.error.flatten().fieldErrors, null, 2)
  );
  // Fail fast — ne pas démarrer avec une config invalide
  process.exit(1);
}

export const env = _parsed.data;

// ── HELPERS ───────────────────────────────────────────────────
export const isDev = env.NODE_ENV === "development";
export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";

export const hasRedis = !!env.REDIS_URL;
export const hasWhatsApp =
  !!(env.WHATSAPP_TOKEN || env.TWILIO_AUTH_TOKEN);
export const hasStripe = !!env.STRIPE_SECRET_KEY;
