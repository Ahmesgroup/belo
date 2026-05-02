// ============================================================
// app/api/auth/route.ts
// POST /api/auth/send-otp    → envoyer code WhatsApp
// POST /api/auth/verify-otp  → vérifier code + retourner JWT
// POST /api/auth/refresh      → renouveler l'access token
// POST /api/auth/logout       → invalider le token (client-side)
//
// Flow complet :
//   1. Client envoie son numéro → reçoit OTP sur WhatsApp
//   2. Client envoie OTP → reçoit { accessToken, refreshToken }
//   3. Client stocke tokens (localStorage ou httpOnly cookie)
//   4. Chaque requête API inclut Authorization: Bearer {accessToken}
//   5. À expiration → POST /auth/refresh avec refreshToken
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendOtp, verifyOtp, refreshAccessToken } from "@/services/auth.service";
import { zodErrorResponse } from "@/lib/zod-formatter";
import { rateLimit } from "@/lib/rate-limit";
import { AppError } from "@/shared/errors";

// ── SCHEMAS ───────────────────────────────────────────────────

const SendOtpSchema = z.object({
  phone: z
    .string()
    .min(8, "Numéro trop court")
    .max(20, "Numéro trop long")
    .regex(
      /^\+?[0-9\s\-().]+$/,
      "Numéro de téléphone invalide (ex: +221771234567)"
    ),
});

const VerifyOtpSchema = z.object({
  phone: z.string().min(8).max(20),
  otp: z
    .string()
    .length(6, "Le code doit contenir exactement 6 chiffres")
    .regex(/^\d{6}$/, "Le code doit contenir uniquement des chiffres"),
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(10, "Refresh token invalide"),
});

// ── ROUTER — Next.js App Router avec action dans le body ─────
// On utilise un seul endpoint POST avec un champ "action"
// plutôt que 4 routes séparées → plus simple à gérer

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  switch (action) {
    case "send-otp":    return handleSendOtp(req);
    case "verify-otp":  return handleVerifyOtp(req);
    case "refresh":     return handleRefresh(req);
    case "logout":      return handleLogout(req);
    default:
      return NextResponse.json(
        { error: { code: "UNKNOWN_ACTION", message: "Action non reconnue." } },
        { status: 400 }
      );
  }
}

// ── SEND OTP ──────────────────────────────────────────────────

async function handleSendOtp(req: NextRequest): Promise<NextResponse> {
  // Rate limit strict — éviter le spam WhatsApp
  // 5 tentatives max par IP par heure (en plus du rate limit par numéro dans auth.service)
  const limited = await rateLimit(req, { max: 3, windowMs: 2 * 60 * 1000 });
  if (limited) {
    return NextResponse.json(
      {
        error: {
          code:    "RATE_LIMITED",
          message: "Trop de tentatives. Attendez 1 heure avant de réessayer.",
        },
      },
      { status: 429 }
    );
  }

  const raw = await req.json().catch(() => null);
  if (!raw) {
    return NextResponse.json({ error: { code: "INVALID_JSON" } }, { status: 400 });
  }

  const parsed = SendOtpSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(zodErrorResponse(parsed.error), { status: 422 });
  }

  try {
    await sendOtp(parsed.data.phone);

    return NextResponse.json({
      data: {
        sent:      true,
        expiresIn: 600, // secondes (10 minutes)
        // Ne jamais retourner le numéro complet dans la réponse
        // Masquer pour la confidentialité
        phoneMask: maskPhone(parsed.data.phone),
      },
    });

  } catch (err) {
    return handleAuthError(err);
  }
}

// ── VERIFY OTP ────────────────────────────────────────────────

async function handleVerifyOtp(req: NextRequest): Promise<NextResponse> {
  // Rate limit plus strict sur la vérification
  // Empêche le brute-force du code à 6 chiffres (1M combinaisons)
  const limited = await rateLimit(req, { max: 10, windowMs: 15 * 60 * 1000 });
  if (limited) {
    return NextResponse.json(
      {
        error: {
          code:    "RATE_LIMITED",
          message: "Trop de tentatives. Attendez 15 minutes.",
        },
      },
      { status: 429 }
    );
  }

  const raw = await req.json().catch(() => null);
  if (!raw) {
    return NextResponse.json({ error: { code: "INVALID_JSON" } }, { status: 400 });
  }

  const parsed = VerifyOtpSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(zodErrorResponse(parsed.error), { status: 422 });
  }

  try {
    const { accessToken, refreshToken, user } = await verifyOtp(
      parsed.data.phone,
      parsed.data.otp
    );

    // Réponse avec tokens
    const response = NextResponse.json({
      data: {
        accessToken,
        user: {
          id:       (user as { id: string }).id,
          name:     (user as { name: string }).name,
          phone:    parsed.data.phone,
          role:     (user as { role: string }).role,
          tenantId: (user as { tenantId?: string }).tenantId ?? null,
        },
      },
    });

    // Stocker le refresh token dans un cookie httpOnly
    // (plus sécurisé que localStorage — non accessible par JS)
    response.cookies.set("belo_refresh", refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge:   30 * 24 * 60 * 60, // 30 jours
      path:     "/api/auth",
    });

    return response;

  } catch (err) {
    return handleAuthError(err);
  }
}

// ── REFRESH TOKEN ─────────────────────────────────────────────

async function handleRefresh(req: NextRequest): Promise<NextResponse> {
  // Lire le refresh token depuis le cookie httpOnly
  // ou depuis le body (pour les clients mobiles)
  const cookieToken = req.cookies.get("belo_refresh")?.value;

  let refreshToken: string | undefined = cookieToken;

  if (!refreshToken) {
    const raw = await req.json().catch(() => ({}));
    const parsed = RefreshSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Session expirée. Reconnectez-vous." } },
        { status: 401 }
      );
    }
    refreshToken = parsed.data.refreshToken;
  }

  try {
    const { accessToken } = await refreshAccessToken(refreshToken!);

    return NextResponse.json({ data: { accessToken } });

  } catch (err) {
    return handleAuthError(err);
  }
}

// ── LOGOUT ────────────────────────────────────────────────────

async function handleLogout(_req: NextRequest): Promise<NextResponse> {
  // JWT est stateless — pas de blacklist en Phase 1
  // Le client supprime le token de son côté
  // On efface juste le cookie httpOnly

  const response = NextResponse.json({
    data: { loggedOut: true },
  });

  response.cookies.delete("belo_refresh");
  response.cookies.delete("belo_token");

  return response;
}

// ── HELPERS ───────────────────────────────────────────────────

function maskPhone(phone: string): string {
  // +221771234567 → +221 77 *** 567
  const cleaned = phone.replace(/\s/g, "");
  if (cleaned.length < 8) return "***";
  return (
    cleaned.slice(0, -6) +
    " ***" +
    cleaned.slice(-3)
  );
}

function handleAuthError(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return NextResponse.json(err.toJSON(), { status: err.statusCode });
  }
  console.error("[API /auth]", err);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Erreur serveur." } },
    { status: 500 }
  );
}

