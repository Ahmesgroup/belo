import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/db/prisma";
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
        id:             true,
        name:           true,
        slug:           true,
        phone:          true,
        whatsapp:       true,
        email:          true,
        address:        true,
        city:           true,
        country:        true,
        photos:         true,
        plan:           true,
        socials:        true,
        depositEnabled: true,
        depositPercent: true,
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
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
