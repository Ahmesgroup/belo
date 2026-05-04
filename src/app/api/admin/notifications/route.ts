// GET   /api/admin/notifications         → list (unread first) + unread count
// PATCH /api/admin/notifications?id=     → mark single as read
// PATCH /api/admin/notifications?all=1   → mark all as read

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/infrastructure/db/prisma";
import { withAuth, withRole } from "@/lib/route-auth";
import { handleRouteError } from "@/shared/errors";

const GetSchema = z.object({
  page:      z.coerce.number().int().positive().default(1),
  pageSize:  z.coerce.number().int().min(1).max(50).default(20),
  unreadOnly:z.coerce.boolean().default(false),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await withAuth(req);
    const check = withRole(auth, ["ADMIN", "SUPER_ADMIN", "SUPPORT"]);
    if (!check.ok) return check.response;

    const { searchParams } = new URL(req.url);
    const parsed = GetSchema.safeParse({
      page:       searchParams.get("page")       ?? 1,
      pageSize:   searchParams.get("pageSize")   ?? 20,
      unreadOnly: searchParams.get("unreadOnly") ?? false,
    });
    if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_PARAMS" } }, { status: 422 });

    const { page, pageSize, unreadOnly } = parsed.data;
    const where = unreadOnly ? { read: false } : {};

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.adminNotification.findMany({
        where,
        orderBy: [{ read: "asc" }, { createdAt: "desc" }],
        skip:    (page - 1) * pageSize,
        take:    pageSize,
      }),
      prisma.adminNotification.count({ where }),
      prisma.adminNotification.count({ where: { read: false } }),
    ]);

    return NextResponse.json({
      data: {
        notifications,
        unreadCount,
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

    const { searchParams } = new URL(req.url);
    const markAll = searchParams.get("all") === "1";
    const id      = searchParams.get("id");

    if (markAll) {
      const { count } = await prisma.adminNotification.updateMany({
        where: { read: false },
        data:  { read: true },
      });
      return NextResponse.json({ data: { updated: count } });
    }

    if (!id) return NextResponse.json({ error: { code: "MISSING_ID" } }, { status: 400 });

    const updated = await prisma.adminNotification.update({
      where: { id },
      data:  { read: true },
    });
    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleRouteError(err);
  }
}
