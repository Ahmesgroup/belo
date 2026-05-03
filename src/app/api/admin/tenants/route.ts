// ============================================================
// app/api/admin/tenants/route.ts
// GET  /api/admin/tenants              → liste complète + filtres
// POST /api/admin/tenants?action=do-action&id=xxx → action sur un salon
// POST /api/admin/tenants?action=bulk  → actions en masse
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/infrastructure/db/prisma";
import { withAuth, withRole } from "@/lib/route-auth";
import { zodErrorResponse } from "@/lib/zod-formatter";
import { handleRouteError, AppErrors } from "@/shared/errors";

// ── SCHEMAS ───────────────────────────────────────────────────

const GetAdminTenantsSchema = z.object({
  status:   z.enum(["PENDING", "ACTIVE", "SUSPENDED", "BLOCKED"]).optional(),
  plan:     z.enum(["FREE", "PRO", "PREMIUM"]).optional(),
  city:     z.string().optional(),
  search:   z.string().max(100).optional(),
  fraud:    z.coerce.boolean().optional(),
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sortBy:   z.enum(["revenue", "bookings", "health", "createdAt"]).default("createdAt"),
  sortDir:  z.enum(["asc", "desc"]).default("desc"),
});

const AdminActionSchema = z.object({
  action: z.enum([
    "validate",
    "block",
    "suspend",
    "reactivate",
    "change_plan",
    "send_message",
  ]),
  newPlan: z.enum(["FREE", "PRO", "PREMIUM"]).optional(),
  message: z.string().max(1000).optional(),
  reason:  z.string().max(500).optional(),
});

const BulkActionSchema = z.object({
  tenantIds: z.array(z.string().min(1)).min(1).max(50),
  action:    z.enum(["validate", "block", "suspend", "reactivate"]),
  reason:    z.string().max(500).optional(),
});

// ── GET /api/admin/tenants ────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const auth = await withAuth(req);
    const roleCheck = withRole(auth, ["ADMIN", "SUPER_ADMIN", "SUPPORT"]);
    if (!roleCheck.ok) return roleCheck.response;

    const { searchParams } = new URL(req.url);
    const parsed = GetAdminTenantsSchema.safeParse({
      status:   searchParams.get("status")   ?? undefined,
      plan:     searchParams.get("plan")     ?? undefined,
      city:     searchParams.get("city")     ?? undefined,
      search:   searchParams.get("search")   ?? undefined,
      fraud:    searchParams.get("fraud")    ?? undefined,
      page:     searchParams.get("page")     ?? 1,
      pageSize: searchParams.get("pageSize") ?? 25,
      sortBy:   searchParams.get("sortBy")   ?? "createdAt",
      sortDir:  searchParams.get("sortDir")  ?? "desc",
    });

    if (!parsed.success) {
      return NextResponse.json(zodErrorResponse(parsed.error), { status: 422 });
    }

    const { status, plan, city, search, fraud, page, pageSize, sortBy, sortDir } = parsed.data;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (plan)   where.plan   = plan;
    if (city)   where.city   = { contains: city, mode: "insensitive" };
    if (fraud)  where.fraudAlerts = { some: { status: { in: ["NEW", "UNDER_REVIEW"] } } };
    if (search) {
      where.OR = [
        { name:  { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const orderBy: Record<string, string> =
      sortBy === "revenue"  ? { bookings: sortDir } :
      sortBy === "bookings" ? { bookingsUsedMonth: sortDir } :
      { createdAt: sortDir };

    const [tenants, total, stats] = await Promise.all([
      prisma.tenant.findMany({
        where: where as any,
        select: {
          id:            true,
          name:          true,
          slug:          true,
          city:          true,
          country:       true,
          phone:         true,
          email:         true,
          plan:          true,
          status:        true,
          createdAt:         true,
          bookingsUsedMonth: true,
          _count: {
            select: {
              bookings:    true,
              fraudAlerts: true,
            },
          },
          fraudAlerts: {
            where: { status: { in: ["NEW", "UNDER_REVIEW"] } },
            select: { id: true, riskScore: true, status: true },
            take: 1,
          },
          users: {
            where:  { role: "OWNER" },
            select: { id: true, name: true, phone: true },
            take: 1,
          },
        },
        orderBy: orderBy as any,
        skip:    (page - 1) * pageSize,
        take:    pageSize,
      }),
      prisma.tenant.count({ where: where as any }),
      prisma.tenant.groupBy({
        by:    ["status"],
        _count: { _all: true },
      }),
    ]);

    const statusCounts = Object.fromEntries(
      stats.map((s) => [s.status, s._count._all])
    );

    return NextResponse.json({
      data: {
        tenants,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        stats: statusCounts,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

// ── POST /api/admin/tenants ───────────────────────────────────
// ?action=do-action&id=TENANT_ID  → action sur un salon
// ?action=bulk                    → actions en masse

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const routeAction = searchParams.get("action");

  if (routeAction === "bulk") return handleBulk(req);
  if (routeAction === "do-action") return handleAction(req, searchParams.get("id"));
  return NextResponse.json(
    { error: { code: "UNKNOWN_ACTION", message: "Paramètre action requis: do-action ou bulk." } },
    { status: 400 }
  );
}

// ── Action sur un salon ───────────────────────────────────────

async function handleAction(req: NextRequest, tenantId: string | null) {
  try {
    if (!tenantId) {
      return NextResponse.json(
        { error: { code: "MISSING_PARAM", message: "Paramètre id requis." } },
        { status: 400 }
      );
    }

    const auth = await withAuth(req);

    const raw = await req.json().catch(() => null);
    if (!raw) return NextResponse.json(AppErrors.INVALID_JSON().toJSON(), { status: 400 });

    const parsed = AdminActionSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(zodErrorResponse(parsed.error), { status: 422 });
    }

    const { action, newPlan, message, reason } = parsed.data;

    const requiresSuperAdmin = action === "change_plan"
      ? auth.ok && auth.role !== "SUPER_ADMIN" && auth.role !== "ADMIN"
      : false;

    if (requiresSuperAdmin) {
      return NextResponse.json(AppErrors.FORBIDDEN("Seul un Admin peut modifier les plans.").toJSON(), { status: 403 });
    }

    const roleCheck = withRole(auth, ["ADMIN", "SUPER_ADMIN", "SUPPORT"]);
    if (!roleCheck.ok) return roleCheck.response;

    if (auth.ok && auth.role === "SUPPORT" && action !== "validate") {
      return NextResponse.json(
        AppErrors.FORBIDDEN("Le support peut seulement valider les salons.").toJSON(),
        { status: 403 }
      );
    }

    const tenant = await prisma.tenant.findUnique({
      where:  { id: tenantId },
      select: { id: true, name: true, status: true, plan: true, phone: true, whatsapp: true },
    });

    if (!tenant) {
      return NextResponse.json(AppErrors.TENANT_NOT_FOUND().toJSON(), { status: 404 });
    }

    let result: Record<string, unknown> = {};

    await prisma.$transaction(async (tx) => {
      switch (action) {
        case "validate":
          await tx.tenant.update({ where: { id: tenantId }, data: { status: "ACTIVE" } });
          result = { status: "ACTIVE", message: "Salon validé et activé." };
          break;
        case "block":
          await tx.tenant.update({ where: { id: tenantId }, data: { status: "BLOCKED" } });
          result = { status: "BLOCKED" };
          break;
        case "suspend":
          await tx.tenant.update({ where: { id: tenantId }, data: { status: "SUSPENDED" } });
          result = { status: "SUSPENDED" };
          break;
        case "reactivate":
          await tx.tenant.update({ where: { id: tenantId }, data: { status: "ACTIVE" } });
          result = { status: "ACTIVE" };
          break;
        case "change_plan":
          if (!newPlan) throw new Error("newPlan requis pour change_plan");
          await tx.tenant.update({ where: { id: tenantId }, data: { plan: newPlan } });
          result = { plan: newPlan, previousPlan: tenant.plan };
          break;
        case "send_message":
          await tx.notificationLog.create({
            data: {
              tenantId,
              type:            "PROMO",
              channel:         "whatsapp",
              status:          "PENDING",
              recipient:       tenant.whatsapp ?? tenant.phone ?? "",
              idempotencyKey:  `admin-msg-${tenantId}-${Date.now()}`,
              payload:         { message: message ?? "", isAdminMessage: true },
            },
          });
          result = { messageSent: true };
          break;
      }

      await tx.auditLog.create({
        data: {
          action:   `tenant.${action}`,
          entity:   "Tenant",
          entityId: tenantId,
          actorId:  auth.ok ? auth.userId : null,
          oldValue: { status: tenant.status, plan: tenant.plan },
          newValue: { ...result, reason },
        },
      });
    });

    return NextResponse.json({ data: { success: true, action, ...result } });
  } catch (err) {
    return handleRouteError(err);
  }
}

// ── Actions en masse ──────────────────────────────────────────

async function handleBulk(req: NextRequest) {
  try {
    const auth = await withAuth(req);
    const roleCheck = withRole(auth, ["ADMIN", "SUPER_ADMIN"]);
    if (!roleCheck.ok) return roleCheck.response;

    const raw = await req.json().catch(() => null);
    if (!raw) return NextResponse.json(AppErrors.INVALID_JSON().toJSON(), { status: 400 });

    const parsed = BulkActionSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(zodErrorResponse(parsed.error), { status: 422 });
    }

    const { tenantIds, action, reason } = parsed.data;

    const statusMap: Record<string, string> = {
      validate:   "ACTIVE",
      block:      "BLOCKED",
      suspend:    "SUSPENDED",
      reactivate: "ACTIVE",
    };

    const newStatus = statusMap[action];

    await prisma.$transaction(async (tx) => {
      await tx.tenant.updateMany({
        where: { id: { in: tenantIds } },
        data:  {
          status: newStatus as any,
        },
      });

      await tx.auditLog.createMany({
        data: tenantIds.map((id) => ({
          action:   `tenant.${action}`,
          entity:   "Tenant",
          entityId: id,
          actorId:  auth.ok ? auth.userId : null,
          newValue: { status: newStatus, reason, bulk: true },
        })),
      });
    });

    return NextResponse.json({
      data: { success: true, action, count: tenantIds.length, status: newStatus },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
