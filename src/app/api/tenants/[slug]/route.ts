import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/infrastructure/db/prisma";
import { withAuth, withRole } from "@/middleware";
import { handleRouteError, AppErrors } from "@/shared/errors";

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [{ id: params.slug }, { slug: params.slug }],
        status: "ACTIVE",
      },
      select: {
        id:                true,
        name:              true,
        slug:              true,
        phone:             true,
        whatsapp:          true,
        email:             true,
        address:           true,
        city:              true,
        country:           true,
        photos:            true,
        coverUrl:          true,
        plan:              true,
        socials:           true,
        depositEnabled:    true,
        depositPercent:    true,
        bookingsUsedMonth: true,
        horaires:          true,
        services: {
          where:   { isActive: true },
          select: {
            id:          true,
            name:        true,
            category:    true,
            priceCents:  true,
            durationMin: true,
            photos:      true,
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
        _count: { select: { bookings: true } },
      },
    });

    if (!tenant) {
      return NextResponse.json(AppErrors.TENANT_NOT_FOUND().toJSON(), { status: 404 });
    }

    return NextResponse.json(
      { data: tenant },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" } }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

const HorairesDay = z.object({ open: z.boolean(), from: z.string(), to: z.string() });

const PatchSchema = z.object({
  name:     z.string().min(2).max(100).optional(),
  phone:    z.string().optional(),
  address:  z.string().optional(),
  city:     z.string().optional(),
  email:    z.string().email().optional(),
  horaires: z.array(HorairesDay).length(7).optional(),
  socials:  z.record(z.string()).optional(),
}).partial();

export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const auth = await withAuth(req);
    const roleCheck = withRole(auth, ["OWNER", "STAFF", "ADMIN", "SUPER_ADMIN"]);
    if (!roleCheck.ok) return roleCheck.response;

    const raw = await req.json().catch(() => null);
    if (!raw) return NextResponse.json({ error: { code: "INVALID_JSON" } }, { status: 400 });

    const parsed = PatchSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const existing = await prisma.tenant.findFirst({
      where: { OR: [{ id: params.slug }, { slug: params.slug }] },
      select: { id: true },
    });
    if (!existing) return NextResponse.json(AppErrors.TENANT_NOT_FOUND().toJSON(), { status: 404 });

    const updated = await prisma.tenant.update({
      where:  { id: existing.id },
      data:   parsed.data,
      select: { id: true, name: true, slug: true, plan: true, updatedAt: true },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleRouteError(err);
  }
}
