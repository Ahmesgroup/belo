// GET /api/admin/logs → audit log global paginé + filtrable

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/infrastructure/db/prisma";
import { withAuth, withRole } from "@/lib/route-auth";
import { handleRouteError } from "@/shared/errors";

const GetSchema = z.object({
  action:   z.string().optional(),
  entity:   z.string().optional(),
  actorId:  z.string().optional(),
  tenantId: z.string().optional(),
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(40),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await withAuth(req);
    const check = withRole(auth, ["ADMIN", "SUPER_ADMIN", "SUPPORT"]);
    if (!check.ok) return check.response;

    const { searchParams } = new URL(req.url);
    const parsed = GetSchema.safeParse({
      action:   searchParams.get("action")   ?? undefined,
      entity:   searchParams.get("entity")   ?? undefined,
      actorId:  searchParams.get("actorId")  ?? undefined,
      tenantId: searchParams.get("tenantId") ?? undefined,
      page:     searchParams.get("page")     ?? 1,
      pageSize: searchParams.get("pageSize") ?? 40,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: { code: "INVALID_PARAMS" } }, { status: 422 });
    }

    const { action, entity, actorId, tenantId, page, pageSize } = parsed.data;

    const where: Record<string, unknown> = {};
    if (action)   where.action   = { contains: action,   mode: "insensitive" };
    if (entity)   where.entity   = entity;
    if (actorId)  where.actorId  = actorId;
    if (tenantId) where.tenantId = tenantId;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: where as any,
        include: {
          actor:  { select: { id: true, name: true, phone: true, role: true } },
          tenant: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
      }),
      prisma.auditLog.count({ where: where as any }),
    ]);

    return NextResponse.json({
      data: {
        logs,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
