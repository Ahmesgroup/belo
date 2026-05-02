import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/infrastructure/db/prisma";
import { withAuth, withRole, withTenant } from "@/middleware";
import { handleRouteError } from "@/shared/errors";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const service = await prisma.service.findUnique({
      where:  { id: params.id },
      select: {
        id: true, name: true, category: true, priceCents: true, durationMin: true,
        photos: true, isActive: true,
        tenant: { select: { id: true, name: true, city: true } },
      },
    });
    if (!service) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    return NextResponse.json({ data: service });
  } catch (err) {
    return handleRouteError(err);
  }
}

const PatchServiceSchema = z.object({
  name:        z.string().min(2).max(100).optional(),
  priceCents:  z.number().int().positive().optional(),
  durationMin: z.number().int().min(15).max(480).optional(),
  category:    z.string().optional(),
  isActive:    z.boolean().optional(),
}).partial();

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await withAuth(req);
    const roleCheck = withRole(auth, ["OWNER", "STAFF", "ADMIN", "SUPER_ADMIN"]);
    if (!roleCheck.ok) return roleCheck.response;

    const existing = await prisma.service.findUnique({
      where:  { id: params.id },
      select: { tenantId: true },
    });
    if (!existing) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });

    const tenantCheck = withTenant(auth, existing.tenantId);
    if (!tenantCheck.ok) return tenantCheck.response;

    const raw = await req.json().catch(() => null);
    if (!raw) return NextResponse.json({ error: { code: "INVALID_JSON" } }, { status: 400 });

    const parsed = PatchServiceSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR" } }, { status: 422 });

    const updated = await prisma.service.update({
      where:  { id: params.id },
      data:   parsed.data,
      select: { id: true, name: true, category: true, priceCents: true, durationMin: true, isActive: true },
    });
    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await withAuth(req);
    const roleCheck = withRole(auth, ["OWNER", "ADMIN", "SUPER_ADMIN"]);
    if (!roleCheck.ok) return roleCheck.response;

    const existing = await prisma.service.findUnique({
      where:  { id: params.id },
      select: { tenantId: true },
    });
    if (!existing) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });

    const tenantCheck = withTenant(auth, existing.tenantId);
    if (!tenantCheck.ok) return tenantCheck.response;

    await prisma.service.update({ where: { id: params.id }, data: { isActive: false } });
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    return handleRouteError(err);
  }
}
