// GET    /api/favorites?tenantId=   → is this tenant a favorite?
// POST   /api/favorites              → add favorite  → emitEvent("favorite.created")
// DELETE /api/favorites?tenantId=   → remove favorite

import "@/lib/event-handlers";

import { NextRequest, NextResponse } from "next/server";
import { z }                from "zod";
import { prisma }           from "@/infrastructure/db/prisma";
import { withAuth }         from "@/lib/route-auth";
import { handleRouteError } from "@/shared/errors";
import { emitEvent }        from "@/lib/events";
import { getCorsHeaders }   from "@/lib/cors";

const BodySchema = z.object({ tenantId: z.string().min(1) });

export async function GET(req: NextRequest) {
  try {
    const auth = await withAuth(req);
    if (!auth.ok) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });

    const tenantId = new URL(req.url).searchParams.get("tenantId");
    if (!tenantId) {
      // Return all favorites for the user
      const favorites = await prisma.favorite.findMany({
        where:  { userId: auth.userId },
        select: { tenantId: true, createdAt: true, tenant: { select: { name: true, slug: true, coverUrl: true, city: true } } },
        orderBy:{ createdAt: "desc" },
      });
      return NextResponse.json({ data: { favorites } }, { headers: getCorsHeaders(req) });
    }

    const fav = await prisma.favorite.findUnique({
      where: { userId_tenantId: { userId: auth.userId, tenantId } },
    });
    return NextResponse.json({ data: { isFavorite: !!fav } }, { headers: getCorsHeaders(req) });
  } catch (err) { return handleRouteError(err); }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await withAuth(req);
    if (!auth.ok) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });

    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR" } }, { status: 422 });

    const { tenantId } = parsed.data;

    const favorite = await prisma.favorite.upsert({
      where:  { userId_tenantId: { userId: auth.userId, tenantId } },
      update: {},
      create: { userId: auth.userId, tenantId },
    });

    await emitEvent("favorite.created", { tenantId, userId: auth.userId });

    return NextResponse.json({ data: { favorite } }, { status: 201, headers: getCorsHeaders(req) });
  } catch (err) { return handleRouteError(err); }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await withAuth(req);
    if (!auth.ok) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });

    const tenantId = new URL(req.url).searchParams.get("tenantId");
    if (!tenantId) return NextResponse.json({ error: { code: "MISSING_PARAM" } }, { status: 400 });

    await prisma.favorite.deleteMany({
      where: { userId: auth.userId, tenantId },
    });

    return NextResponse.json({ data: { removed: true } }, { headers: getCorsHeaders(req) });
  } catch (err) { return handleRouteError(err); }
}

export function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(req) });
}
