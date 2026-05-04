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

// ───────── LANGUAGE DETECTION ─────────
const SUPPORTED_LANGS = ["fr", "en"] as const;

function detectLang(req: NextRequest): "fr" | "en" {
  // 1. Persisted preference cookie (set by LangProvider)
  const cookie = req.cookies.get("belo_lang")?.value;
  if (cookie === "en") return "en";
  if (cookie === "fr") return "fr";

  // 2. Accept-Language header (browser preference)
  const accept = req.headers.get("accept-language") ?? "";
  if (/\ben\b/.test(accept) && !/\bfr\b/.test(accept.split(",")[0])) return "en";

  // 3. Default to French (Senegal primary market)
  return "fr";
}

// ───────── PROXY (IMPORTANT) ─────────
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Language routing ─────────────────────────────────────
  // Redirect bare "/" to "/fr" or "/en" based on browser preference.
  // Never redirect API routes, static files, or already-localised paths.
  if (
    pathname === "/" &&
    !pathname.startsWith("/api") &&
    !SUPPORTED_LANGS.some(l => pathname.startsWith(`/${l}`))
  ) {
    const lang = detectLang(req);
    return NextResponse.redirect(new URL(`/${lang}`, req.url));
  }

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