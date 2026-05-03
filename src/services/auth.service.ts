// ============================================================
// services/auth.service.ts
// Auth OTP par téléphone — pas de mot de passe
// Flow : envoyer OTP WhatsApp → vérifier → JWT
//
// Coût minimal :
//   - OTP stocké en DB (pas de Redis nécessaire Phase 1)
//   - 6 chiffres, expire dans 10 minutes
//   - 5 tentatives max par téléphone par heure
// ============================================================

import { prisma } from "@/infrastructure/db/prisma";
import { signJWT, signRefreshToken } from "@/lib/route-auth";
import { AppError } from "@/shared/errors";
import { env } from "@/config/env";

// ── OTP TABLE (dans Prisma schema ajouter si besoin) ──────────
// On réutilise la table AuditLog pour stocker les OTP temporaires
// ou mieux : une table dédiée OtpCode (petite, auto-purge)

// ── ENVOYER OTP ───────────────────────────────────────────────

export async function sendOtp(phone: string): Promise<{ sent: boolean }> {
  // Normaliser le numéro
  const normalizedPhone = normalizePhone(phone);

  // Rate limiting is now handled at the API route layer (rateLimitByPhone in auth/route.ts).
  // No per-phone check here — single source of truth, no double blocking.

  // Générer OTP 6 chiffres
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Stocker OTP hashé (bcrypt ou simple hash pour OTP court-lived)
  const hashedOtp = await hashOtp(otp);

  // Invalider les anciens OTP pour ce numéro
  await prisma.auditLog.create({
    data: {
      action: "otp.sent",
      entity: "User",
      entityId: normalizedPhone,
      newValue: {
        hashedOtp,
        expiresAt: expiresAt.toISOString(),
        phone: normalizedPhone,
      },
    },
  });

  // Envoyer via WhatsApp (via outbox ou direct selon urgence)
  const message = `🔐 *Code Belo :* ${otp}\n\nValable 10 minutes. Ne partagez jamais ce code.`;

  // Pour l'auth, on envoie direct (pas via outbox — besoin immédiat)
  await sendOtpDirect(normalizedPhone, message);

  console.log(`[Auth] OTP envoyé à ${normalizedPhone}`);
  return { sent: true };
}

// ── VÉRIFIER OTP ET CRÉER SESSION ─────────────────────────────

export async function verifyOtp(
  phone: string,
  otp: string
): Promise<{ accessToken: string; refreshToken: string; user: object }> {
  const normalizedPhone = normalizePhone(phone);

  // Récupérer le dernier OTP envoyé
  const otpLog = await prisma.auditLog.findFirst({
    where: {
      action: "otp.sent",
      entityId: normalizedPhone,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otpLog) {
    throw new AppError("OTP_NOT_FOUND", "Aucun code envoyé pour ce numéro.", 400);
  }

  const { hashedOtp, expiresAt } = otpLog.newValue as {
    hashedOtp: string;
    expiresAt: string;
  };

  // Vérifier expiration
  if (new Date() > new Date(expiresAt)) {
    throw new AppError("OTP_EXPIRED", "Code expiré. Demandez un nouveau code.", 400);
  }

  // Vérifier le code
  const isValid = await verifyOtpHash(otp, hashedOtp);
  if (!isValid) {
    throw new AppError("OTP_INVALID", "Code incorrect.", 400);
  }

  // Créer ou récupérer l'utilisateur
  let user = await prisma.user.findUnique({
    where: { phone: normalizedPhone },
    select: { id: true, phone: true, name: true, role: true, tenantId: true },
  });

  if (!user) {
    // Premier login = création du compte client
    user = await prisma.user.create({
      data: {
        phone: normalizedPhone,
        name: formatPhoneName(normalizedPhone), // nom temporaire
        role: "CLIENT",
      },
      select: { id: true, phone: true, name: true, role: true, tenantId: true },
    });
  }

  // Générer les tokens
  const [accessToken, refreshToken] = await Promise.all([
    signJWT({
      sub: user.id,
      role: user.role,
      tenantId: user.tenantId ?? undefined,
    }),
    signRefreshToken(user.id),
  ]);

  // Log connexion
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return { accessToken, refreshToken, user };
}

// ── REFRESH TOKEN ─────────────────────────────────────────────

export async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string }> {
  const { jwtVerify } = await import("jose");
  const secret = new TextEncoder().encode(env.JWT_SECRET);

  try {
    const { payload } = await jwtVerify(refreshToken, secret);

    if ((payload as { type?: string }).type !== "refresh") {
      throw new AppError("TOKEN_INVALID", "Token invalide.", 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub! },
      select: { id: true, role: true, tenantId: true, deletedAt: true },
    });

    if (!user || user.deletedAt) {
      throw new AppError("USER_NOT_FOUND", "Compte introuvable.", 404);
    }

    const accessToken = await signJWT({
      sub: user.id,
      role: user.role,
      tenantId: user.tenantId ?? undefined,
    });

    return { accessToken };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("TOKEN_INVALID", "Session expirée.", 401);
  }
}

// ── UTILS ─────────────────────────────────────────────────────

function normalizePhone(phone: string): string {
  // +221 77 123 45 67 → +221771234567
  return "+" + phone.replace(/[^0-9]/g, "");
}

function formatPhoneName(phone: string): string {
  return `Client ${phone.slice(-4)}`; // ex: "Client 5678"
}

async function hashOtp(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp + env.JWT_SECRET);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyOtpHash(otp: string, hash: string): Promise<boolean> {
  const computed = await hashOtp(otp);
  return computed === hash;
}

async function sendOtpDirect(phone: string, message: string): Promise<void> {
  if (!env.WHATSAPP_PHONE_ID || !env.WHATSAPP_TOKEN) {
    console.log(`\n🔐 OTP pour ${phone}: ${message}\n`);
    return;
  }

  const to = phone.replace(/^\+/, "");

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
        text: { body: message },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new AppError("WHATSAPP_ERROR", `Envoi OTP échoué: ${JSON.stringify(err)}`, 500);
  }
}



