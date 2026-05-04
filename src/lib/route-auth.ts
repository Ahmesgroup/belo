// ============================================================
// lib/route-auth.ts
// Utilities for API route handlers — identity resolution, role
// enforcement, tenant scoping, JWT signing.
//
// These helpers do NOT run at the edge. They are imported by
// Next.js API route handlers (Server Components / Route Handlers).
// Edge-level interception lives in proxy.ts.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, SignJWT } from "jose";

// ── withAuth ──────────────────────────────────────────────────
// Resolves the authenticated caller from a request.
// Fast path: uses headers injected by proxy.ts for /api/admin routes.
// Slow path: parses JWT from Authorization header or httpOnly cookie.

export async function withAuth(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  const role   = req.headers.get("x-user-role");
  if (userId && role) {
    return { ok: true as const, userId, role, tenantId: req.headers.get("x-tenant-id") };
  }

  const token =
    req.headers.get("authorization")?.replace("Bearer ", "").trim() ??
    req.cookies.get("belo_token")?.value;

  if (!token) return { ok: false as const };

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "");
    const { payload } = await jwtVerify(token, secret);
    const p = payload as { sub: string; role: string; tenantId?: string };
    return { ok: true as const, userId: p.sub, role: p.role, tenantId: p.tenantId ?? null };
  } catch {
    return { ok: false as const };
  }
}

// ── withRole ──────────────────────────────────────────────────

export function withRole(
  auth: { ok: boolean; role?: string },
  roles: string[]
): { ok: true } | { ok: false; response: NextResponse } {
  if (!auth.ok || !auth.role) {
    return { ok: false, response: NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 }) };
  }
  if (!roles.includes(auth.role)) {
    return { ok: false, response: NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 }) };
  }
  return { ok: true };
}

// ── withTenant ────────────────────────────────────────────────

export function withTenant(
  auth: { ok: boolean; role?: string; tenantId?: string | null },
  resourceTenantId: string
): { ok: true } | { ok: false; response: NextResponse } {
  if (!auth.ok) {
    return { ok: false, response: NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 }) };
  }
  if (auth.role === "SUPER_ADMIN" || auth.role === "ADMIN") return { ok: true };
  if (auth.tenantId !== resourceTenantId) {
    return { ok: false, response: NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 }) };
  }
  return { ok: true };
}

// ── withActiveTenant ─────────────────────────────────────────
// Verifies that a tenant exists, is ACTIVE, and belongs to the
// caller. Used in booking, payment, and service routes.
// Returns the tenant id or an error response.

import { prisma } from "@/infrastructure/db/prisma";

export async function withActiveTenant(
  auth:     { ok: boolean; role?: string; tenantId?: string | null },
  tenantId: string
): Promise<{ ok: true; tenantId: string } | { ok: false; response: NextResponse }> {
  const ownership = withTenant(auth, tenantId);
  if (!ownership.ok) return ownership;

  const tenant = await prisma.tenant.findUnique({
    where:  { id: tenantId },
    select: { id: true, status: true },
  });

  if (!tenant) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "TENANT_NOT_FOUND", message: "Salon introuvable." } },
        { status: 404 }
      ),
    };
  }

  if (tenant.status !== "ACTIVE") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "TENANT_INACTIVE", message: `Salon ${tenant.status.toLowerCase()}.` } },
        { status: 403 }
      ),
    };
  }

  return { ok: true, tenantId: tenant.id };
}

// ── JWT signing ───────────────────────────────────────────────

export async function signJWT(payload: { sub: string; role: string; tenantId?: string }): Promise<string> {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "");
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRES_IN ?? "7d")
    .sign(secret);
}

export async function signRefreshToken(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "");
  return new SignJWT({ sub: userId, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(process.env.REFRESH_TOKEN_EXPIRES_IN ?? "30d")
    .sign(secret);
}
