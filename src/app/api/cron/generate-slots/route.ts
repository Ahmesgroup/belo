import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/db/prisma";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  console.log("[Cron/GenerateSlots] Started");

  try {
    const tenants = await prisma.tenant.findMany({
      where:   { status: "ACTIVE" },
      include: { services: { where: { isActive: true } } },
    });

    let totalCreated = 0;
    const errors: string[] = [];

    for (const tenant of tenants) {
      try {
        const slots: { tenantId: string; serviceId: string; startsAt: Date; endsAt: Date; isAvailable: boolean }[] = [];
        const now = new Date();

        for (let d = 1; d <= 14; d++) {
          const date = new Date(now);
          date.setUTCDate(date.getUTCDate() + d);
          if (date.getUTCDay() === 0) continue; // skip Sunday

          for (let h = 9; h < 18; h++) {
            if (h === 12 || h === 13) continue; // lunch break
            for (const svc of tenant.services) {
              const st = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), h, 0, 0));
              const en = new Date(st.getTime() + svc.durationMin * 60000);
              if (en.getUTCHours() > 18) continue;
              slots.push({ tenantId: tenant.id, serviceId: svc.id, startsAt: st, endsAt: en, isAvailable: true });
            }
          }
        }

        if (slots.length > 0) {
          const result = await prisma.slot.createMany({ data: slots, skipDuplicates: true });
          totalCreated += result.count;
        }
      } catch (err) {
        const msg = `Tenant ${tenant.id} (${tenant.name}): ${err instanceof Error ? err.message : String(err)}`;
        console.error("[Cron/GenerateSlots]", msg);
        errors.push(msg);
      }
    }

    const duration = Date.now() - startedAt;
    console.log(`[Cron/GenerateSlots] Done — ${totalCreated} slots created, ${errors.length} errors, ${duration}ms`);

    return NextResponse.json({
      ok:           true,
      slotsCreated: totalCreated,
      tenants:      tenants.length,
      errors:       errors.length > 0 ? errors : undefined,
      duration:     `${duration}ms`,
    });

  } catch (err) {
    console.error("[Cron/GenerateSlots] Fatal error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
