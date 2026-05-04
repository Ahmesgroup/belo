// ============================================================
// services/ranking.service.ts — Geo search + multi-signal ranking
//
// Ranking formula (0–1 normalised score):
//   geo_proximity  × 0.30   (Haversine, closer = better)
//   rating_avg     × 0.20   (0–5 stars)
//   conversion_rate× 0.20   (bookings / views)
//   retention_rate × 0.20   (returning clients / total)
//   no_show_rate   × -0.10  (penalty)
//   ad_boost       × 0.10   (capped paid boost)
//
// Uses $queryRaw so the entire ranking is done at the DB level
// in a single round-trip.
// ============================================================

import { prisma } from "@/infrastructure/db/prisma";
import { Prisma } from "@prisma/client";

export interface SearchParams {
  lat?:      number;
  lng?:      number;
  city?:     string;
  category?: string;
  radius?:   number;    // km, default 30
  page?:     number;
  pageSize?: number;
}

export interface RankedTenant {
  id:             string;
  name:           string;
  slug:           string;
  city:           string | null;
  plan:           string;
  coverUrl:       string | null;
  lat:            number | null;
  lng:            number | null;
  distance:       number | null;  // km
  ratingAvg:      number;
  conversionRate: number;
  bookings24h:    number;
  score:          number;
  bookingCount:   number;
}

export async function searchRanked(params: SearchParams): Promise<{
  tenants: RankedTenant[];
  total:   number;
}> {
  const {
    lat,
    lng,
    city,
    category,
    radius   = 30,
    page     = 1,
    pageSize = 20,
  } = params;

  const offset = (page - 1) * pageSize;
  const hasGeo = lat != null && lng != null;

  // ── Build WHERE clause fragments ──────────────────────────────

  const conditions: Prisma.Sql[] = [
    Prisma.sql`t.status = 'ACTIVE'`,
    Prisma.sql`t."deletedAt" IS NULL`,
  ];

  if (city) {
    conditions.push(Prisma.sql`t.city ILIKE ${`%${city}%`}`);
  }

  if (category) {
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "Service" s
      WHERE s."tenantId" = t.id
        AND s.category = ${category}
        AND s."isActive" = true
    )`);
  }

  if (hasGeo) {
    // Pre-filter by bounding box for index efficiency, then refine by Haversine
    const latDelta = radius / 111.0;
    const lngDelta = radius / (111.0 * Math.cos((lat! * Math.PI) / 180));
    conditions.push(Prisma.sql`(
      t.lat IS NULL
      OR (
        t.lat BETWEEN ${lat! - latDelta} AND ${lat! + latDelta}
        AND t.lng BETWEEN ${lng! - lngDelta} AND ${lng! + lngDelta}
      )
    )`);
  }

  const whereClause = Prisma.join(conditions, " AND ");

  // ── Distance expression ───────────────────────────────────────

  const distanceExpr = hasGeo
    ? Prisma.sql`
        6371.0 * acos(
          LEAST(1.0,
            cos(radians(${lat!})) * cos(radians(COALESCE(t.lat, ${lat!})))
            * cos(radians(COALESCE(t.lng, ${lng!})) - radians(${lng!}))
            + sin(radians(${lat!})) * sin(radians(COALESCE(t.lat, ${lat!})))
          )
        )`
    : Prisma.sql`NULL::DOUBLE PRECISION`;

  // ── Ranking score ─────────────────────────────────────────────

  const scoreExpr = Prisma.sql`(
    CASE
      WHEN ${hasGeo ? Prisma.sql`t.lat IS NOT NULL` : Prisma.sql`false`}
      THEN (1.0 / (${distanceExpr} + 0.01)) * 0.3
      ELSE 0.1
    END
    + COALESCE(m."ratingAvg", 5.0) / 5.0 * 0.2
    + LEAST(1.0, COALESCE(m."conversionRate", 0.0)) * 0.2
    + LEAST(1.0, COALESCE(m."retentionRate", 0.0)) * 0.2
    - LEAST(1.0, COALESCE(m."noShowRate", 0.0)) * 0.1
    + LEAST(0.1, COALESCE(MAX(ac."bidCents"), 0)::DOUBLE PRECISION / 10000.0) * 0.1
    + CASE WHEN t.plan = 'PREMIUM' THEN 0.05 WHEN t.plan = 'PRO' THEN 0.02 ELSE 0 END
  )`;

  // ── Main query ────────────────────────────────────────────────

  const rows = await prisma.$queryRaw<Array<{
    id: string; name: string; slug: string; city: string | null;
    plan: string; coverUrl: string | null; lat: number | null; lng: number | null;
    distance: number | null; ratingAvg: number; conversionRate: number;
    bookings24h: number; score: number; bookingCount: bigint;
  }>>`
    SELECT
      t.id, t.name, t.slug, t.city, t.plan, t."coverUrl", t.lat, t.lng,
      ${distanceExpr}                              AS distance,
      COALESCE(m."ratingAvg",      5.0)::FLOAT    AS "ratingAvg",
      COALESCE(m."conversionRate", 0.0)::FLOAT    AS "conversionRate",
      COALESCE(tr."bookings24h",   0)::INT         AS "bookings24h",
      ${scoreExpr}::FLOAT                          AS score,
      COUNT(DISTINCT b.id)                         AS "bookingCount"
    FROM "Tenant" t
    LEFT JOIN "TenantMetrics"   m  ON t.id = m."tenantId"
    LEFT JOIN "TenantTrending"  tr ON t.id = tr."tenantId"
    LEFT JOIN "AdCampaign"      ac ON t.id = ac."tenantId" AND ac."isActive" = true
    LEFT JOIN "Booking"         b  ON t.id = b."tenantId"
    WHERE ${whereClause}
    GROUP BY t.id, m.id, tr.id
    ORDER BY score DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  // Count query (cheaper — no metrics JOIN)
  const countResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) AS count
    FROM "Tenant" t
    WHERE ${whereClause}
  `;

  const total = Number(countResult[0]?.count ?? 0);

  const tenants: RankedTenant[] = rows.map(r => ({
    id:             r.id,
    name:           r.name,
    slug:           r.slug,
    city:           r.city,
    plan:           r.plan,
    coverUrl:       r.coverUrl,
    lat:            r.lat,
    lng:            r.lng,
    distance:       r.distance != null ? Math.round(r.distance * 10) / 10 : null,
    ratingAvg:      Number(r.ratingAvg),
    conversionRate: Number(r.conversionRate),
    bookings24h:    Number(r.bookings24h),
    score:          Math.round(Number(r.score) * 1000) / 1000,
    bookingCount:   Number(r.bookingCount),
  }));

  return { tenants, total };
}

/**
 * Recalculates TenantMetrics for a single tenant.
 * Called by /api/cron/metrics to keep scores fresh.
 */
export async function recalculateMetrics(tenantId: string): Promise<void> {
  const d30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [bookings30d, reviews] = await Promise.all([
    prisma.booking.findMany({
      where:  { tenantId, createdAt: { gte: d30 } },
      select: { status: true, userId: true },
    }),
    prisma.review.findMany({
      where:  { tenantId, isVisible: true },
      select: { rating: true },
    }),
  ]);

  const total      = bookings30d.length;
  const confirmed  = bookings30d.filter(b => b.status === "CONFIRMED" || b.status === "COMPLETED").length;
  const noShows    = bookings30d.filter(b => b.status === "NO_SHOW").length;
  const uniqueUsers= new Set(bookings30d.map(b => b.userId)).size;
  const returningCount = total > 0 ? (total - uniqueUsers) : 0;

  const ratingAvg      = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 5.0;
  const conversionRate = total > 0 ? confirmed / total : 0;
  const retentionRate  = uniqueUsers > 0 ? returningCount / uniqueUsers : 0;
  const noShowRate     = confirmed > 0 ? noShows / confirmed : 0;

  await prisma.tenantMetrics.upsert({
    where:  { tenantId },
    update: { ratingAvg, conversionRate, retentionRate, noShowRate },
    create: { tenantId, ratingAvg, conversionRate, retentionRate, noShowRate },
  });
}
