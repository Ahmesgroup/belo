// GET   /api/admin/settings     → toutes les configurations système
// PATCH /api/admin/settings     → batch update (body: { key: value })

import "@/lib/event-handlers";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/infrastructure/db/prisma";
import { withAuth, withRole } from "@/lib/route-auth";
import { handleRouteError } from "@/shared/errors";
import { onSettingsUpdated } from "@/services/plan.service";
import { emitEvent } from "@/lib/events";

const ALLOWED_KEYS = [
  "maintenance_mode",
  "commission_percent",
  "active_providers",
  "otp_bypass",
] as const;

type SettingKey = typeof ALLOWED_KEYS[number];

const PatchSchema = z.record(
  z.enum(ALLOWED_KEYS),
  z.union([z.boolean(), z.number(), z.string(), z.array(z.string())])
);

export async function GET(req: NextRequest) {
  try {
    const auth = await withAuth(req);
    const check = withRole(auth, ["ADMIN", "SUPER_ADMIN"]);
    if (!check.ok) return check.response;

    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: [...ALLOWED_KEYS] } },
    });

    // Transform to object map
    const settings: Record<string, unknown> = Object.fromEntries(
      rows.map(r => [r.key, r.value])
    );

    // Fill in defaults for missing keys
    const defaults: Record<SettingKey, unknown> = {
      maintenance_mode:    false,
      commission_percent:  3,
      active_providers:    ["WAVE", "ORANGE_MONEY"],
      otp_bypass:          false,
    };
    for (const k of ALLOWED_KEYS) {
      if (!(k in settings)) settings[k] = defaults[k];
    }

    return NextResponse.json({ data: { settings } });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await withAuth(req);
    const check = withRole(auth, ["SUPER_ADMIN"]);
    if (!check.ok) return check.response;

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: { code: "INVALID_JSON" } }, { status: 400 });

    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: { code: "INVALID_DATA", fields: parsed.error.flatten() } }, { status: 422 });
    }

    // Batch upsert
    await prisma.$transaction(
      Object.entries(parsed.data).map(([key, value]) =>
        prisma.systemSetting.upsert({
          where:  { key },
          update: { value: value as any, updatedBy: auth.userId },
          create: { key,  value: value as any, updatedBy: auth.userId },
        })
      )
    );

    await prisma.auditLog.create({
      data: {
        action:   "settings.updated",
        entity:   "SystemSetting",
        entityId: "global",
        actorId:  auth.userId,
        newValue: parsed.data,
      },
    });

    // Invalidate in-process cache + emit settings.updated event (creates audit log, notifies all handlers)
    onSettingsUpdated();
    await emitEvent("settings.updated", {
      keys:    Object.keys(parsed.data),
      adminId: auth.userId,
    });

    return NextResponse.json({ data: { updated: Object.keys(parsed.data) } });
  } catch (err) {
    return handleRouteError(err);
  }
}
