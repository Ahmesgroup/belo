const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "https://belo-khaki.vercel.app",
];

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const safeOrigin = ALLOWED_ORIGINS.includes(origin ?? "")
    ? origin!
    : "http://localhost:3000";

  return {
    "Access-Control-Allow-Origin":  safeOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
