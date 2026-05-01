import { NextRequest, NextResponse } from "next/server";
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error:"Unauthorized" }, { status:401 });
  }
  try {
    const { processNotificationBatch } = await import("@/infrastructure/queue/worker");
    const start = Date.now();
    await processNotificationBatch();
    return NextResponse.json({ ok:true, duration:`${Date.now()-start}ms` });
  } catch(err) {
    console.error("[Cron/Notifications]", err);
    return NextResponse.json({ error:"Internal error" }, { status:500 });
  }
}
