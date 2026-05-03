// GET   /api/admin/team         → liste admins + super_admins
// PATCH /api/admin/team?id=     → change rôle ou désactive

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/infrastructure/db/prisma";
import { withAuth, withRole } from "@/lib/route-auth";
import { handleRouteError, AppErrors } from "@/shared/errors";

const PatchSchema = z.object({
  role:      z.enum(["ADMIN", "SUPER_ADMIN", "CLIENT"]).optional(),
  deletedAt: z.string().datetime().nullish(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await withAuth(req);
    const check = withRole(auth, ["ADMIN", "SUPER_ADMIN"]);
    if (!check.ok) return check.response;

    const team = await prisma.user.findMany({
      where: {
        role: { in: ["ADMIN", "SUPER_ADMIN"] },
        deletedAt: null,
      },
      select: {
        id:          true,
        phone:       true,
        email:       true,
        name:        true,
        role:        true,
        lastLoginAt: true,
        createdAt:   true,
      },
      orderBy: [{ role: "asc" }, { lastLoginAt: "desc" }],
    });

    return NextResponse.json({ data: { team } });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await withAuth(req);
    // Only SUPER_ADMIN can change team roles
    const check = withRole(auth, ["SUPER_ADMIN"]);
    if (!check.ok) return check.response;

    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: { code: "MISSING_ID" } }, { status: 400 });

    // Cannot modify own account
    if (id === auth.userId) {
      return NextResponse.json(
        AppErrors.FORBIDDEN("Impossible de modifier son propre compte.").toJSON(),
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: { code: "INVALID_DATA" } }, { status: 422 });
    }

    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!target) return NextResponse.json(AppErrors.NOT_FOUND("Utilisateur").toJSON(), { status: 404 });

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(parsed.data.role      ? { role: parsed.data.role }           : {}),
        ...(parsed.data.deletedAt !== undefined ? { deletedAt: parsed.data.deletedAt ? new Date(parsed.data.deletedAt) : null } : {}),
      },
      select: { id: true, name: true, role: true, phone: true },
    });

    await prisma.auditLog.create({
      data: {
        action:   "team.role_changed",
        entity:   "User",
        entityId: id,
        actorId:  auth.userId,
        oldValue: { role: target.role },
        newValue: parsed.data,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleRouteError(err);
  }
}
