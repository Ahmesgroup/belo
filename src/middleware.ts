import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, SignJWT } from "jose";

// ── NEXT.JS MIDDLEWARE ────────────────────────────────────────────
// Runs at the edge before route handlers.
// For /api/admin: validates JWT, checks admin role, injects headers.
// Route handlers then use withAuth() which reads injected headers (fast path).

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Auth endpoints handle their own rate limiting and validation — pass through immediately
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/admin")) {
    // Accept token from Authorization header OR httpOnly cookie
    const token =
      req.headers.get("authorization")?.replace("Bearer ", "").trim() ??
      req.cookies.get("belo_token")?.value;

    if (!token) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
    }

    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "");
      const { payload } = await jwtVerify(token, secret);
      const p = payload as { sub: string; role: string; tenantId?: string };

      // Enforce admin role at the edge — fail fast before hitting route handlers
      if (p.role !== "ADMIN" && p.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
      }

      // Inject verified identity into headers so route handlers skip re-parsing JWT
      const next = NextResponse.next();
      next.headers.set("x-user-id",   p.sub);
      next.headers.set("x-user-role", p.role);
      if (p.tenantId) next.headers.set("x-tenant-id", p.tenantId);
      return next;

    } catch {
      return NextResponse.json({ error: { code: "TOKEN_INVALID" } }, { status: 401 });
    }
  }

  return NextResponse.next();
}

// ── HELPERS FOR ROUTE HANDLERS ────────────────────────────────────

export async function withAuth(req: NextRequest) {
  // Fast path: headers injected by middleware (admin routes only)
  const userId = req.headers.get("x-user-id");
  const role   = req.headers.get("x-user-role");
  if (userId && role) {
    return { ok: true as const, userId, role, tenantId: req.headers.get("x-tenant-id") };
  }

  // Parse JWT from Authorization header or httpOnly cookie
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
