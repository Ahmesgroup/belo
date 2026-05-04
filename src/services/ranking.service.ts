// ============================================================
// services/ranking.service.ts — 6-factor Wolt/Uber-level ranking
//
// finalScore =
//   relevance       × 0.25  (category + service availability)
//   distance        × 0.20  (Haversine, normalised 0→1)
//   performance     × 0.20  (conversion + retention − noshow)
//   personalization × 0.20  (UserPreference match)
//   business        × 0.10  (ad bid + plan boost)
//   freshness       × 0.05  (trending score + new salon)
//
// Everything executed in a single $queryRaw — no N+1.
// ============================================================

import { prisma }  from "@/infrastructure/db/prisma";
import { Prisma }  from "@prisma/client";

// ── Public types ──────────────────────────────────────────────

export interface SearchParams {
  lat?:           number;
  lng?:           number;
  city?:          string;
  category?:      string;
  query?:         string;    // free text search
  userId?:        string;    // for personalisation
  radius?:        number;    // km, default 30
  page?:          number;
  pageSize?:      number;
  debugScore?:    boolean;   // include score breakdown
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
  // Scores (0–1)
  distance:       number | null;   // km
  ratingAvg:      number;
  bookings24h:    number;
  trendingScore:  number;
  finalScore:     number;
  // Debug breakdown (only when debugScore=true)
  scoreBreakdown?: {
    relevance:       number;
    distance:        number;
    performance:     number;
    personalization: number;
    business:        number;
    freshness:       number;
  };
}

// ── Main search ───────────────────────────────────────────────

export async function searchRanked(params: SearchParams): Promise<{
  tenants: RankedTenant[];
  total:   number;
}> {
  const {
    lat,
    lng,
    city,
    category,
    query,
    userId,
    radius    = 30,
    page      = 1,
    pageSize  = 20,
    debugScore = false,
  } = params;

  const offset  = (page - 1) * pageSize;
  const hasGeo  = lat != null && lng != null;
  const hasUser = userId != null;

  // ── WHERE conditions ──────────────────────────────────────────

  const conditions: Prisma.Sql[] = [
    Prisma.sql`t.status = 'ACTIVE'`,
    Prisma.sql`t."deletedAt" IS NULL`,
  ];

  if (city) {
    conditions.push(Prisma.sql`t.city ILIKE ${`%${city}%`}`);
  }

  if (query) {
    conditions.push(Prisma.sql`(
      t.name ILIKE ${`%${query}%`}
      OR t.address ILIKE ${`%${query}%`}
      OR EXISTS (
        SELECT 1 FROM "Service" sq WHERE sq."tenantId" = t.id
          AND sq."isActive" = true
          AND sq.name ILIKE ${`%${query}%`}
      )
    )`);
  }

  if (category) {
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "Service" sc WHERE sc."tenantId" = t.id
        AND sc.category = ${category} AND sc."isActive" = true
    )`);
  }

  if (hasGeo) {
    const latD = radius / 111.0;
    const lngD = radius / (111.0 * Math.cos((lat! * Math.PI) / 180));
    conditions.push(Prisma.sql`(
      t.lat IS NULL OR (
        t.lat BETWEEN ${lat! - latD} AND ${lat! + latD}
        AND t.lng BETWEEN ${lng! - lngD} AND ${lng! + lngD}
      )
    )`);
  }

  const where = Prisma.join(conditions, " AND ");

  // ── Distance expression (km, LEAST protects acos domain) ─────

  const distKm = hasGeo
    ? Prisma.sql`
        6371.0 * acos(LEAST(1.0,
          cos(radians(${lat!})) * cos(radians(COALESCE(t.lat, ${lat!})))
          * cos(radians(COALESCE(t.lng, ${lng!})) - radians(${lng!}))
          + sin(radians(${lat!})) * sin(radians(COALESCE(t.lat, ${lat!})))
        ))`
    : Prisma.sql`NULL::DOUBLE PRECISION`;

  // ── Normalised distance score (0→1, fallback 0.05 when no geo) ─

  const distScore = hasGeo
    ? Prisma.sql`CASE
        WHEN t.lat IS NULL THEN 0.05
        ELSE GREATEST(0.0, 1.0 - (${distKm} / ${radius}))
      END`
    : Prisma.sql`0.05::DOUBLE PRECISION`;

  // ── Relevance score ───────────────────────────────────────────

  const relevanceScore = category
    ? Prisma.sql`CASE WHEN EXISTS (
        SELECT 1 FROM "Service" sr WHERE sr."tenantId" = t.id
          AND sr.category = ${category} AND sr."isActive" = true
      ) THEN 1.0 ELSE 0.3 END::DOUBLE PRECISION`
    : Prisma.sql`1.0::DOUBLE PRECISION`;

  // ── Performance score ─────────────────────────────────────────

  const performanceScore = Prisma.sql`LEAST(1.0,
    COALESCE(m."conversionRate", 0.0) * 0.4
    + COALESCE(m."retentionRate", 0.0) * 0.4
    - COALESCE(m."noShowRate", 0.0)  * 0.2
    + COALESCE(m."ratingAvg", 5.0) / 5.0 * 0.2
  )`;

  // ── Personalisation score ─────────────────────────────────────
  // If userId provided and UserPreference exists, boost matching categories/cities.

  const personScore = hasUser
    ? Prisma.sql`CASE
        WHEN up."userId" IS NULL THEN 0.5
        ELSE LEAST(1.0,
          (CASE WHEN t.city = ANY(up."favoriteCities") THEN 0.4 ELSE 0.0 END)
          + (CASE WHEN ${category ?? ""} = ANY(up."favoriteCategories") THEN 0.4 ELSE 0.0 END)
          + 0.2
        )
      END::DOUBLE PRECISION`
    : Prisma.sql`0.5::DOUBLE PRECISION`;

  // ── Business score (ad + plan) ────────────────────────────────

  const businessScore = Prisma.sql`LEAST(1.0,
    COALESCE(MAX(ac."bidCents"), 0)::DOUBLE PRECISION / 10000.0 * 0.6
    + CASE t.plan WHEN 'PREMIUM' THEN 0.4 WHEN 'PRO' THEN 0.2 ELSE 0.0 END
  )`;

  // ── Freshness score (trending + new salons) ───────────────────

  const freshnessScore = Prisma.sql`LEAST(1.0,
    COALESCE(tr."score", 0.0) / 100.0 * 0.7
    + CASE WHEN t."createdAt" > NOW() - INTERVAL '30 days' THEN 0.3 ELSE 0.0 END
  )`;

  // ── Final weighted score ──────────────────────────────────────

  const finalScore = Prisma.sql`(
    ${relevanceScore}  * 0.25
    + ${distScore}     * 0.20
    + ${performanceScore} * 0.20
    + ${personScore}   * 0.20
    + ${businessScore} * 0.10
    + ${freshnessScore}* 0.05
  )`;

  // ── Main query ────────────────────────────────────────────────

  type RawRow = {
    id: string; name: string; slug: string; city: string | null;
    plan: string; coverUrl: string | null;
    lat: number | null; lng: number | null;
    distKm: number | null;
    ratingAvg: number; bookings24h: number; trendingScore: number;
    finalScore: number;
    // debug
    relevance: number; distScore: number; performance: number;
    personalization: number; business: number; freshness: number;
  };

  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      t.id, t.name, t.slug, t.city, t.plan, t."coverUrl", t.lat, t.lng,
      ${distKm}::FLOAT                              AS "distKm",
      COALESCE(m."ratingAvg",  5.0)::FLOAT          AS "ratingAvg",
      COALESCE(tr."bookings24h", 0)::INT             AS "bookings24h",
      COALESCE(tr.score, 0.0)::FLOAT                AS "trendingScore",
      ${finalScore}::FLOAT                           AS "finalScore",
      ${relevanceScore}::FLOAT                       AS relevance,
      ${distScore}::FLOAT                            AS "distScore",
      ${performanceScore}::FLOAT                     AS performance,
      ${personScore}::FLOAT                          AS personalization,
      ${businessScore}::FLOAT                        AS business,
      ${freshnessScore}::FLOAT                       AS freshness
    FROM "Tenant" t
    LEFT JOIN "TenantMetrics"   m   ON t.id = m."tenantId"
    LEFT JOIN "TenantTrending"  tr  ON t.id = tr."tenantId"
    LEFT JOIN "AdCampaign"      ac  ON t.id = ac."tenantId" AND ac."isActive" = true
    ${hasUser
      ? Prisma.sql`LEFT JOIN "UserPreference" up ON up."userId" = ${userId!}`
      : Prisma.sql``
    }
    WHERE ${where}
    GROUP BY t.id, m.id, tr.id ${hasUser ? Prisma.sql`, up."userId", up."favoriteCities", up."favoriteCategories"` : Prisma.sql``}
    ORDER BY "finalScore" DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const countResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) AS count FROM "Tenant" t WHERE ${where}
  `;

  const total   = Number(countResult[0]?.count ?? 0);
  const tenants = rows.map(r => ({
    id:            r.id,
    name:          r.name,
    slug:          r.slug,
    city:          r.city,
    plan:          r.plan,
    coverUrl:      r.coverUrl,
    lat:           r.lat,
    lng:           r.lng,
    distance:      r.distKm != null ? Math.round(r.distKm * 10) / 10 : null,
    ratingAvg:     Number(r.ratingAvg),
    bookings24h:   Number(r.bookings24h),
    trendingScore: Number(r.trendingScore),
    finalScore:    Math.round(Number(r.finalScore) * 1000) / 1000,
    ...(debugScore ? {
      scoreBreakdown: {
        relevance:       Math.round(Number(r.relevance) * 1000) / 1000,
        distance:        Math.round(Number(r.distScore) * 1000) / 1000,
        performance:     Math.round(Number(r.performance) * 1000) / 1000,
        personalization: Math.round(Number(r.personalization) * 1000) / 1000,
        business:        Math.round(Number(r.business) * 1000) / 1000,
        freshness:       Math.round(Number(r.freshness) * 1000) / 1000,
      },
    } : {}),
  }));

  return { tenants, total };
}

// ── Metrics recalculation ─────────────────────────────────────

export async function recalculateMetrics(tenantId: string): Promise<void> {
  const d30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [bookings, reviews] = await Promise.all([
    prisma.booking.findMany({
      where:  { tenantId, createdAt: { gte: d30 } },
      select: { status: true, userId: true },
    }),
    prisma.review.findMany({
      where:  { tenantId, isVisible: true },
      select: { rating: true },
    }),
  ]);

  const total      = bookings.length;
  const confirmed  = bookings.filter(b => b.status === "CONFIRMED" || b.status === "COMPLETED").length;
  const noShows    = bookings.filter(b => b.status === "NO_SHOW").length;
  const uniqueU    = new Set(bookings.map(b => b.userId)).size;
  const returning  = Math.max(0, total - uniqueU);

  const ratingAvg      = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 5.0;
  const conversionRate = total      > 0 ? confirmed / total : 0;
  const retentionRate  = uniqueU    > 0 ? returning / uniqueU : 0;
  const noShowRate     = confirmed  > 0 ? noShows / confirmed : 0;

  await prisma.tenantMetrics.upsert({
    where:  { tenantId },
    update: { ratingAvg, conversionRate, retentionRate, noShowRate },
    create: { tenantId, ratingAvg, conversionRate, retentionRate, noShowRate },
  });
}
