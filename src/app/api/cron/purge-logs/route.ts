import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/db/prisma";
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error:"Unauthorized" }, { status:401 });
  }
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo  = new Date(Date.now() -  7 * 24 * 60 * 60 * 1000);
  // Monthly quota reset on 1st of month
  const isFirstDay = new Date().getDate() === 1;
  if (isFirstDay) {
    await prisma.tenant.updateMany({ data: { bookingsUsedMonth: 0, bookingsResetAt: new Date() } });
  }
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
  const [otp, notif, audit, rateHits] = await Promise.all([
    prisma.auditLog.deleteMany({ where: { action:"otp.sent", createdAt:{ lt:thirtyDaysAgo } } }),
    prisma.notificationLog.deleteMany({ where: { status:"ARCHIVED", updatedAt:{ lt:sevenDaysAgo } } }),
    prisma.auditLog.deleteMany({ where: { createdAt:{ lt:thirtyDaysAgo }, action:{ notIn:["tenant.blocked","tenant.fraud","tenant.suspended","booking.refunded","admin.role_changed"] } } }),
    // rate.hit entries older than 30 min are stale — all windows (2 min, 15 min) have already expired
    prisma.auditLog.deleteMany({ where: { action:"rate.hit", createdAt:{ lt:thirtyMinAgo } } }),
  ]);
  return NextResponse.json({ ok:true, otpPurged:otp.count, notifPurged:notif.count, auditPurged:audit.count, rateHitsPurged:rateHits.count });
}
