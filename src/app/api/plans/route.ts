import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/db/prisma";
import { withAuth } from "@/middleware";
import { z } from "zod";

export async function GET() {
  const configs = await prisma.planConfig.findMany({ orderBy: { plan: "asc" } });
  return NextResponse.json(
    { data: { plans: configs } },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } }
  );
}

const PatchSchema = z.object({
  plan:            z.enum(["FREE", "PRO", "PREMIUM"]),
  priceFcfa:       z.number().min(0).optional(),
  priceEur:        z.number().min(0).optional(),
  priceUsd:        z.number().min(0).optional(),
  priceFcfaAnnual: z.number().min(0).optional(),
  priceEurAnnual:  z.number().min(0).optional(),
  priceUsdAnnual:  z.number().min(0).optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await withAuth(req);
  if (!auth.ok || (auth.role !== "SUPER_ADMIN" && auth.role !== "ADMIN")) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: { code: "INVALID_JSON" } }, { status: 400 });

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_DATA" } }, { status: 422 });
  }
  const { plan, ...prices } = parsed.data;
  const updated = await prisma.planConfig.update({
    where: { plan },
    data:  { ...prices, updatedBy: auth.userId },
  });
  return NextResponse.json({ data: { plan: updated } });
}
