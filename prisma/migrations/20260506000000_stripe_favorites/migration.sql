-- Migration: stripe_favorites
-- Adds Stripe Connect fields to Tenant/Booking + Favorite model

-- Tenant: Stripe Connect
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "stripeAccountId"          TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "stripeOnboardingComplete" BOOLEAN NOT NULL DEFAULT false;

-- Booking: Stripe marketplace
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "stripePaymentIntentId" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "platformFeeCents"      INTEGER NOT NULL DEFAULT 0;

-- Favorite
CREATE TABLE IF NOT EXISTS "Favorite" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "tenantId"  TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Favorite_pkey"             PRIMARY KEY ("id"),
    CONSTRAINT "Favorite_userId_tenantId_key" UNIQUE ("userId", "tenantId"),
    CONSTRAINT "Favorite_userId_fkey"      FOREIGN KEY ("userId")   REFERENCES "User"("id")   ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Favorite_tenantId_fkey"    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Favorite_userId_idx" ON "Favorite"("userId");
