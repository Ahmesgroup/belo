export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: unknown;
  constructor(code: string, message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
  toJSON() {
    return { error: { code: this.code, message: this.message, ...(this.details ? { details: this.details } : {}) } };
  }
}

export const AppErrors = {
  UNAUTHORIZED:    (m="Non authentifié.")       => new AppError("UNAUTHORIZED",    m, 401),
  FORBIDDEN:       (m="Accès refusé.")           => new AppError("FORBIDDEN",       m, 403),
  TOKEN_INVALID:   ()                            => new AppError("TOKEN_INVALID",   "Session expirée.", 401),
  OTP_INVALID:     ()                            => new AppError("OTP_INVALID",     "Code incorrect.", 400),
  OTP_EXPIRED:     ()                            => new AppError("OTP_EXPIRED",     "Code expiré.", 400),
  OTP_RATE_LIMITED:()                            => new AppError("OTP_RATE_LIMITED","Trop de tentatives.", 429),
  TENANT_NOT_FOUND:()                            => new AppError("TENANT_NOT_FOUND","Salon introuvable.", 404),
  SLOT_TAKEN:      ()                            => new AppError("SLOT_TAKEN",      "Créneau déjà réservé.", 409),
  BOOKING_NOT_FOUND:()                           => new AppError("BOOKING_NOT_FOUND","Réservation introuvable.", 404),
  NOT_FOUND:       (e="Ressource")               => new AppError("NOT_FOUND",       `${e} introuvable.`, 404),
  INTERNAL:        (m="Erreur serveur.")         => new AppError("INTERNAL_ERROR",  m, 500),
  RATE_LIMITED:    ()                            => new AppError("RATE_LIMITED",    "Trop de requêtes.", 429),
  INVALID_JSON:    ()                            => new AppError("INVALID_JSON",    "Corps invalide.", 400),
  MISSING_TENANT:  ()                            => new AppError("MISSING_TENANT",  "Contexte salon manquant.", 400),
  PAYMENT_NOT_CONFIGURED: (p: string)            => new AppError("PAYMENT_NOT_CONFIGURED", `${p} non configuré.`, 500),
  PAYMENT_FAILED:  (m="Paiement échoué.")        => new AppError("PAYMENT_FAILED",  m, 402),
  PLAN_LIMIT_BOOKINGS:(plan:string, limit:number) => new AppError("PLAN_LIMIT_BOOKINGS", `Plan ${plan}: ${limit} réservations/mois max.`, 403),
  PLAN_LIMIT_SERVICES:(plan:string, limit:number) => new AppError("PLAN_LIMIT_SERVICES", `Plan ${plan}: ${limit} service(s) max.`, 403),
} as const;

import { NextResponse } from "next/server";
export function handleRouteError(err: unknown): NextResponse {
  if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
  if (isPrismaP2002(err)) return NextResponse.json(AppErrors.SLOT_TAKEN().toJSON(), { status: 409 });
  if (isPrismaP2025(err)) return NextResponse.json(AppErrors.NOT_FOUND().toJSON(), { status: 404 });
  console.error("[API Error]", err);
  return NextResponse.json(AppErrors.INTERNAL().toJSON(), { status: 500 });
}
function isPrismaP2002(e: unknown) { return typeof e === "object" && e !== null && "code" in e && (e as {code:string}).code === "P2002"; }
function isPrismaP2025(e: unknown) { return typeof e === "object" && e !== null && "code" in e && (e as {code:string}).code === "P2025"; }
