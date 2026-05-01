import type { NextRequest } from "next/server";
const store = new Map<string, { count: number; resetAt: number }>();
setInterval(() => { const now = Date.now(); for (const [k,v] of store) if (v.resetAt < now) store.delete(k); }, 60_000);

export async function rateLimit(req: NextRequest, opts: { max: number; windowMs: number }): Promise<boolean> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const key = `${ip}:${req.nextUrl.pathname}`;
  const now = Date.now();
  const e = store.get(key);
  if (!e || e.resetAt < now) { store.set(key, { count: 1, resetAt: now + opts.windowMs }); return false; }
  e.count++;
  if (e.count > opts.max) return true;
  store.set(key, e);
  return false;
}
