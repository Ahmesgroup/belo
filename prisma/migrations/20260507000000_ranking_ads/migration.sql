-- Migration: ranking_ads
-- Adds geo fields, ranking engine, trending, ads campaign system

-- ── Tenant: geo coordinates ──────────────────────────────────────
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "lat" DOUBLE PRECISION;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "lng" DOUBLE PRECISION;

-- ── TenantMetrics ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "TenantMetrics" (
    "id"             TEXT NOT NULL,
    "tenantId"       TEXT NOT NULL,
    "ratingAvg"      DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "conversionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "retentionRate"  DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "noShowRate"     DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "responseTime"   DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TenantMetrics_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TenantMetrics_tenantId_key" UNIQUE ("tenantId"),
    CONSTRAINT "TenantMetrics_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "TenantMetrics_tenantId_idx" ON "TenantMetrics"("tenantId");

-- ── TenantTrending ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "TenantTrending" (
    "id"           TEXT NOT NULL,
    "tenantId"     TEXT NOT NULL,
    "bookings24h"  INTEGER NOT NULL DEFAULT 0,
    "views24h"     INTEGER NOT NULL DEFAULT 0,
    "favorites24h" INTEGER NOT NULL DEFAULT 0,
    "score"        DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TenantTrending_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TenantTrending_tenantId_key" UNIQUE ("tenantId"),
    CONSTRAINT "TenantTrending_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "TenantTrending_score_idx"    ON "TenantTrending"("score");

-- ── UserPreference ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "UserPreference" (
    "id"                 TEXT NOT NULL,
    "userId"             TEXT NOT NULL,
    "favoriteCategories" TEXT[] NOT NULL DEFAULT '{}',
    "favoriteCities"     TEXT[] NOT NULL DEFAULT '{}',
    "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UserPreference_userId_key" UNIQUE ("userId"),
    CONSTRAINT "UserPreference_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "UserPreference_userId_idx" ON "UserPreference"("userId");

-- ── AdCampaign ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "AdCampaign" (
    "id"          TEXT NOT NULL,
    "tenantId"    TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "bidCents"    INTEGER NOT NULL DEFAULT 0,
    "budgetCents" INTEGER NOT NULL DEFAULT 0,
    "spentCents"  INTEGER NOT NULL DEFAULT 0,
    "targetCPA"   INTEGER,
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdCampaign_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AdCampaign_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AdCampaign_tenantId_isActive_idx" ON "AdCampaign"("tenantId","isActive");

-- ── GeoBid ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "GeoBid" (
    "id"          TEXT NOT NULL,
    "campaignId"  TEXT NOT NULL,
    "citySlug"    TEXT NOT NULL,
    "bidModifier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    CONSTRAINT "GeoBid_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GeoBid_campaignId_citySlug_key" UNIQUE ("campaignId","citySlug"),
    CONSTRAINT "GeoBid_campaignId_fkey"
        FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- ── Performance indexes ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "Tenant_lat_lng_idx" ON "Tenant"("lat","lng")
    WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Seed default geo coordinates for seeded salons (Dakar area)
UPDATE "Tenant" SET lat = 14.7167, lng = -17.4677
WHERE slug LIKE '%-dakar' AND lat IS NULL;
