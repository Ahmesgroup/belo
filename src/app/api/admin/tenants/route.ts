// ============================================================
// app/api/admin/tenants/route.ts
// Gestion des salons par l'équipe admin Belo
//
// GET    /api/admin/tenants           → liste complète + filtres
// POST   /api/admin/tenants/[id]/action → bloquer, valider, changer plan...
//
// IMPORTANT : chaque action est loggée dans AuditLog
// Permissions : voir matrice dans shared/errors.ts
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/infrastructure/db/prisma";
import { withAuth, withRole } from "@/middleware";
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
    "validate",     // PENDING → ACTIVE
    "block",        // → BLOCKED
    "suspend",      // → SUSPENDED
    "reactivate",   // BLOCKED/SUSPENDED → ACTIVE
    "change_plan",  // changer FREE/PRO/PREMIUM
    "send_message", // envoyer message WhatsApp au gérant
  ]),
  // Pour change_plan
  newPlan: z.enum(["FREE", "PRO", "PREMIUM"]).optional(),
  // Pour send_message
  message: z.string().max(1000).optional(),
  // Pour toutes les actions
  reason:  z.string().max(500).optional(),
});

const BulkActionSchema = z.object({
  tenantIds: z.array(z.string().cuid()).min(1).max(50),
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
    if (fraud)  where.fraudAlerts = { some: { status: { in: ["NEW", "REVIEWING"] } } };
    if (search) {
      where.OR = [
        { name:  { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const orderBy: Record<string, string> =
      sortBy === "revenue"  ? { bookings: sortDir } :
      sortBy === "bookings" ? { bookingsThisMonth: sortDir } :
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
          isVerified:    true,
          createdAt:     true,
          bookingsThisMonth: true,
          _count: {
            select: {
              bookings:    true,
              reviews:     true,
              fraudAlerts: true,
            },
          },
          fraudAlerts: {
            where: { status: { in: ["NEW", "REVIEWING"] } },
            select: { id: true, score: true, status: true },
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
      // Stats globales pour la topbar admin
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

// ── POST /api/admin/tenants/[id]/action ───────────────────────
// Action sur un salon spécifique

export async function POST_ACTION(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await withAuth(req);

    const raw = await req.json().catch(() => null);
    if (!raw) return NextResponse.json(AppErrors.INVALID_JSON().toJSON(), { status: 400 });

    const parsed = AdminActionSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(zodErrorResponse(parsed.error), { status: 422 });
    }

    const { action, newPlan, message, reason } = parsed.data;

    // Vérifier permissions selon l'action
    const requiresSuperAdmin = ["change_plan"].includes(action)
      ? auth.ok && auth.role !== "SUPER_ADMIN" && auth.role !== "ADMIN"
      : false;

    if (requiresSuperAdmin) {
      return NextResponse.json(AppErrors.FORBIDDEN("Seul un Admin peut modifier les plans.").toJSON(), { status: 403 });
    }

    const roleCheck = withRole(auth, ["ADMIN", "SUPER_ADMIN", "SUPPORT"]);
    if (!roleCheck.ok) return roleCheck.response;

    // Support ne peut que valider
    if (auth.ok && auth.role === "SUPPORT" && !["validate"].includes(action)) {
      return NextResponse.json(
        AppErrors.FORBIDDEN("Le support peut seulement valider les salons.").toJSON(),
        { status: 403 }
      );
    }

    const tenant = await prisma.tenant.findUnique({
      where:  { id: params.id },
      select: { id: true, name: true, status: true, plan: true },
    });

    if (!tenant) {
      return NextResponse.json(AppErrors.TENANT_NOT_FOUND().toJSON(), { status: 404 });
    }

    let result: Record<string, unknown> = {};

    await prisma.$transaction(async (tx) => {
      switch (action) {
        case "validate":
          await tx.tenant.update({
            where: { id: params.id },
            data:  { status: "ACTIVE", isVerified: true },
          });
          result = { status: "ACTIVE", message: "Salon validé et activé." };
          break;

        case "block":
          await tx.tenant.update({
            where: { id: params.id },
            data:  { status: "BLOCKED" },
          });
          result = { status: "BLOCKED" };
          break;

        case "suspend":
          await tx.tenant.update({
            where: { id: params.id },
            data:  { status: "SUSPENDED" },
          });
          result = { status: "SUSPENDED" };
          break;

        case "reactivate":
          await tx.tenant.update({
            where: { id: params.id },
            data:  { status: "ACTIVE" },
          });
          result = { status: "ACTIVE" };
          break;

        case "change_plan":
          if (!newPlan) {
            throw new Error("newPlan requis pour change_plan");
          }
          await tx.tenant.update({
            where: { id: params.id },
            data:  { plan: newPlan },
          });
          result = { plan: newPlan, previousPlan: tenant.plan };
          break;

        case "send_message":
          // Enqueue notification WhatsApp via outbox
          await tx.notificationLog.create({
            data: {
              tenantId:  params.id,
              channel:   "WHATSAPP",
              status:    "PENDING",
              payload:   { message: message ?? "", isAdminMessage: true },
            },
          });
          result = { messageSent: true };
          break;
      }

      // TOUJOURS logger l'action admin
      await tx.auditLog.create({
        data: {
          action:   `tenant.${action}`,
          entity:   "Tenant",
          entityId: params.id,
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

// ── POST /api/admin/tenants/bulk ──────────────────────────────
// Actions en masse sur plusieurs salons

export async function POST_BULK(req: NextRequest) {
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
      // Mettre à jour tous les tenants en une seule requête
      await tx.tenant.updateMany({
        where: { id: { in: tenantIds } },
        data:  {
          status: newStatus as any,
          ...(action === "validate" ? { isVerified: true } : {}),
        },
      });

      // Logger chaque action individuellement (audit trail)
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
      data: {
        success: true,
        action,
        count:   tenantIds.length,
        status:  newStatus,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
