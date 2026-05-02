import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/db/prisma";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const photos = [
    { slug: "studio-elegance-dakar",  url: "https://images.pexels.com/photos/3065209/pexels-photo-3065209.jpeg?auto=compress&w=800" },
    { slug: "zen-massage-almadies",   url: "https://images.pexels.com/photos/3997989/pexels-photo-3997989.jpeg?auto=compress&w=800" },
    { slug: "bella-coiffure-mermoz",  url: "https://images.pexels.com/photos/3992870/pexels-photo-3992870.jpeg?auto=compress&w=800" },
    { slug: "king-barber-dakar",      url: "https://images.pexels.com/photos/1813272/pexels-photo-1813272.jpeg?auto=compress&w=800" },
    { slug: "nails-paradise-plateau", url: "https://images.pexels.com/photos/3997386/pexels-photo-3997386.jpeg?auto=compress&w=800" },
  ];

  const results = [];
  for (const { slug, url } of photos) {
    const r = await prisma.tenant.updateMany({ where: { slug }, data: { coverUrl: url } });
    results.push({ slug, updated: r.count });
  }

  return NextResponse.json({ ok: true, results });
}
