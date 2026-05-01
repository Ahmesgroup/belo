import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, SignJWT } from "jose";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Protect admin API routes — valid JWT required
  if (pathname.startsWith("/api/admin")) {
    const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
    if (!token) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
    }
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "");
      await jwtVerify(token, secret);
    } catch {
      return NextResponse.json({ error: { code: "TOKEN_INVALID" } }, { status: 401 });
    }
  }

  return NextResponse.next();
}

// Helpers pour les route handlers
export async function withAuth(req: NextRequest) {
  // 1. Headers injectés par le middleware (rétrocompat)
  const userId = req.headers.get("x-user-id");
  const role   = req.headers.get("x-user-role");
  if (userId && role) {
    return { ok: true as const, userId, role, tenantId: req.headers.get("x-tenant-id") };
  }
  // 2. Parse le Bearer token directement (middleware pass-through)
  const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
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

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/).*)"],
};
