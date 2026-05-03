// GET   /api/plans       → tarifs + limites + features
// PATCH /api/plans       → mettre à jour prix, limites ou features
//                          → déclenche syncPlanToTenants (event + audit)

import "@/lib/event-handlers"; // register handlers

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/db/prisma";
import { withAuth } from "@/lib/route-auth";
import { z } from "zod";
import { syncPlanToTenants } from "@/services/plan.service";

export async function GET() {
  const configs = await prisma.planConfig.findMany({ orderBy: { plan: "asc" } });
  return NextResponse.json(
    { data: { plans: configs } },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } }
  );
}

const LimitsSchema = z.object({
  bookingsPerMonth:  z.number().int().min(0).nullable().optional(),
  services:          z.number().int().min(0).nullable().optional(),
  staff:             z.number().int().min(0).nullable().optional(),
  photosPerService:  z.number().int().min(0).nullable().optional(),
}).optional();

const FeaturesSchema = z.object({
  deposit:          z.boolean().optional(),
  whatsapp:         z.boolean().optional(),
  analytics:        z.boolean().optional(),
  prioritySupport:  z.boolean().optional(),
  customDomain:     z.boolean().optional(),
}).optional();

const PatchSchema = z.object({
  plan:            z.enum(["FREE", "PRO", "PREMIUM"]),
  priceFcfa:       z.number().min(0).optional(),
  priceEur:        z.number().min(0).optional(),
  priceUsd:        z.number().min(0).optional(),
  priceFcfaAnnual: z.number().min(0).optional(),
  priceEurAnnual:  z.number().min(0).optional(),
  priceUsdAnnual:  z.number().min(0).optional(),
  limits:          LimitsSchema,
  features:        FeaturesSchema,
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
    return NextResponse.json({ error: { code: "INVALID_DATA", fields: parsed.error.flatten() } }, { status: 422 });
  }

  const { plan, limits, features, ...prices } = parsed.data;

  // Merge limits/features with existing values (partial update)
  const existing = await prisma.planConfig.findUnique({ where: { plan } });
  const mergedLimits = limits
    ? { ...(existing?.limits as object ?? {}), ...limits }
    : undefined;
  const mergedFeatures = features
    ? { ...(existing?.features as object ?? {}), ...features }
    : undefined;

  const updated = await prisma.planConfig.upsert({
    where:  { plan },
    update: {
      ...prices,
      ...(mergedLimits   !== undefined ? { limits:   mergedLimits   } : {}),
      ...(mergedFeatures !== undefined ? { features: mergedFeatures } : {}),
      updatedBy: auth.userId,
    },
    create: {
      plan,
      ...prices,
      ...(mergedLimits   !== undefined ? { limits:   mergedLimits   } : {}),
      ...(mergedFeatures !== undefined ? { features: mergedFeatures } : {}),
      updatedBy: auth.userId,
    },
  });

  // Sync: emit plan.updated event + audit log
  const changes: Record<string, unknown> = { ...prices };
  if (mergedLimits)   changes.limits   = mergedLimits;
  if (mergedFeatures) changes.features = mergedFeatures;

  const syncResult = await syncPlanToTenants(plan, changes, auth.userId);

  return NextResponse.json({
    data: { plan: updated, sync: syncResult },
  });
}
