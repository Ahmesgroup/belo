import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// ───────── JWT VERIFY ─────────
async function verifyToken(token: string) {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "");
    const { payload } = await jwtVerify(token, secret);
    return payload as { role: string };
  } catch {
    return null;
  }
}

function getToken(req: NextRequest) {
  return (
    req.cookies.get("belo_token")?.value ||
    req.headers.get("authorization")?.replace("Bearer ", "")
  );
}

// ───────── PROXY (IMPORTANT) ─────────
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const token = getToken(req);
  const user = token ? await verifyToken(token) : null;

  // 🔐 ADMIN
  if (pathname.startsWith("/admin")) {
    if (!user || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  // 🔐 DASHBOARD
  if (pathname.startsWith("/dashboard")) {
    if (!user || !["ADMIN", "SUPER_ADMIN", "OWNER", "STAFF"].includes(user.role)) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  // 🔐 PROFIL (IMPORTANT)
  if (pathname.startsWith("/profil")) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  return NextResponse.next();
}

// ───────── MATCHER ─────────
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};