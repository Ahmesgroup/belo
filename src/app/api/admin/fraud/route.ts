// GET  /api/admin/fraud        → liste alertes fraude + tenant
// PATCH /api/admin/fraud?id=  → changer statut d'une alerte

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/infrastructure/db/prisma";
import { withAuth, withRole } from "@/lib/route-auth";
import { handleRouteError } from "@/shared/errors";

const GetSchema = z.object({
  status:   z.enum(["NEW", "UNDER_REVIEW", "ACTION_TAKEN", "CLOSED"]).optional(),
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const PatchSchema = z.object({
  status: z.enum(["UNDER_REVIEW", "ACTION_TAKEN", "CLOSED"]),
  notes:  z.string().max(1000).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await withAuth(req);
    const check = withRole(auth, ["ADMIN", "SUPER_ADMIN", "SUPPORT"]);
    if (!check.ok) return check.response;

    const { searchParams } = new URL(req.url);
    const parsed = GetSchema.safeParse({
      status:   searchParams.get("status")   ?? undefined,
      page:     searchParams.get("page")     ?? 1,
      pageSize: searchParams.get("pageSize") ?? 25,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: { code: "INVALID_PARAMS" } }, { status: 422 });
    }

    const { status, page, pageSize } = parsed.data;
    const where = status ? { status } : {};

    const [alerts, total] = await Promise.all([
      prisma.fraudAlert.findMany({
        where,
        include: {
          tenant: { select: { id: true, name: true, slug: true, city: true, plan: true } },
        },
        orderBy: [{ status: "asc" }, { riskScore: "desc" }, { createdAt: "desc" }],
        skip:  (page - 1) * pageSize,
        take:  pageSize,
      }),
      prisma.fraudAlert.count({ where }),
    ]);

    return NextResponse.json({
      data: {
        alerts,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await withAuth(req);
    const check = withRole(auth, ["ADMIN", "SUPER_ADMIN"]);
    if (!check.ok) return check.response;

    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: { code: "MISSING_ID" } }, { status: 400 });

    const body = await req.json().catch(() => null);
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: { code: "INVALID_DATA" } }, { status: 422 });
    }

    const updated = await prisma.fraudAlert.update({
      where: { id },
      data: {
        status:     parsed.data.status,
        notes:      parsed.data.notes,
        assignedTo: auth.userId,
        resolvedAt: parsed.data.status === "CLOSED" ? new Date() : undefined,
      },
    });

    await prisma.auditLog.create({
      data: {
        action:   `fraud.${parsed.data.status.toLowerCase()}`,
        entity:   "FraudAlert",
        entityId: id,
        actorId:  auth.userId,
        newValue: { status: parsed.data.status, notes: parsed.data.notes },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleRouteError(err);
  }
}
