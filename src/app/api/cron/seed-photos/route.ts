import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/db/prisma";
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const r1 = await prisma.tenant.updateMany({ where: { slug: "king-barber-sicap" }, data: { coverUrl: "https://images.pexels.com/photos/1813272/pexels-photo-1813272.jpeg?auto=compress&w=800" } });
  const r2 = await prisma.tenant.updateMany({ where: { slug: "nails-paradise-thies" }, data: { coverUrl: "https://images.pexels.com/photos/3997386/pexels-photo-3997386.jpeg?auto=compress&w=800" } });
  return NextResponse.json({ ok: true, king: r1.count, nails: r2.count });
}
