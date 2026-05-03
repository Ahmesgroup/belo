-- Migration: admin_enhancements
-- Adds limits/features to PlanConfig + SystemSetting model

-- AlterTable PlanConfig
ALTER TABLE "PlanConfig" ADD COLUMN IF NOT EXISTS "limits"   JSONB;
ALTER TABLE "PlanConfig" ADD COLUMN IF NOT EXISTS "features" JSONB;

-- CreateTable SystemSetting
CREATE TABLE IF NOT EXISTS "SystemSetting" (
    "key"       TEXT NOT NULL,
    "value"     JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- Seed default settings (idempotent via ON CONFLICT DO NOTHING)
INSERT INTO "SystemSetting" ("key", "value", "updatedAt") VALUES
  ('maintenance_mode',   'false',                         NOW()),
  ('commission_percent', '3',                             NOW()),
  ('active_providers',   '["WAVE","ORANGE_MONEY"]',       NOW()),
  ('otp_bypass',         'false',                         NOW())
ON CONFLICT ("key") DO NOTHING;

-- Seed default plan limits (idempotent)
UPDATE "PlanConfig" SET
  "limits"   = '{"bookingsPerMonth":20,"services":3,"staff":0,"photosPerService":3}',
  "features" = '{"deposit":false,"whatsapp":false,"analytics":false,"prioritySupport":false,"customDomain":false}'
WHERE "plan" = 'FREE' AND "limits" IS NULL;

UPDATE "PlanConfig" SET
  "limits"   = '{"bookingsPerMonth":500,"services":20,"staff":5,"photosPerService":10}',
  "features" = '{"deposit":true,"whatsapp":true,"analytics":false,"prioritySupport":false,"customDomain":false}'
WHERE "plan" = 'PRO' AND "limits" IS NULL;

UPDATE "PlanConfig" SET
  "limits"   = '{"bookingsPerMonth":null,"services":null,"staff":null,"photosPerService":50}',
  "features" = '{"deposit":true,"whatsapp":true,"analytics":true,"prioritySupport":true,"customDomain":true}'
WHERE "plan" = 'PREMIUM' AND "limits" IS NULL;
