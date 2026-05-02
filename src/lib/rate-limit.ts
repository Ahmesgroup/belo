import type { NextRequest } from "next/server";

// Rate limiting is handled per-route via DB (prisma.auditLog.count in auth.service.ts).
// This no-op prevents Map-based in-memory state from breaking serverless cold starts.
export async function rateLimit(_req: NextRequest, _opts: { max: number; windowMs: number }): Promise<boolean> {
  return false;
}
