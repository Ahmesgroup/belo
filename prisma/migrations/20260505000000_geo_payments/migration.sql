-- Migration: geo_payments
-- Adds Country, City, PaymentAccount, TenantPayout tables

-- Country
CREATE TABLE IF NOT EXISTS "Country" (
    "code"      TEXT NOT NULL,
    "name"      JSONB NOT NULL,
    "phoneCode" TEXT NOT NULL,
    "currency"  TEXT NOT NULL,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Country_pkey" PRIMARY KEY ("code")
);
CREATE INDEX IF NOT EXISTS "Country_isActive_idx" ON "Country"("isActive");

-- City
CREATE TABLE IF NOT EXISTS "City" (
    "id"          TEXT NOT NULL,
    "name"        JSONB NOT NULL,
    "slug"        TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "City_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "City_slug_key" UNIQUE ("slug"),
    CONSTRAINT "City_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("code") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "City_countryCode_idx" ON "City"("countryCode");
CREATE INDEX IF NOT EXISTS "City_slug_idx"        ON "City"("slug");

-- PaymentAccount (Belo platform accounts)
CREATE TABLE IF NOT EXISTS "PaymentAccount" (
    "id"         TEXT NOT NULL,
    "provider"   TEXT NOT NULL,
    "accountId"  TEXT NOT NULL,
    "label"      TEXT,
    "isPlatform" BOOLEAN NOT NULL DEFAULT true,
    "isActive"   BOOLEAN NOT NULL DEFAULT true,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentAccount_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PaymentAccount_provider_isActive_idx" ON "PaymentAccount"("provider", "isActive");

-- TenantPayout (salon payout info — Phase 2+)
CREATE TABLE IF NOT EXISTS "TenantPayout" (
    "id"            TEXT NOT NULL,
    "tenantId"      TEXT NOT NULL,
    "provider"      TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName"   TEXT,
    "isVerified"    BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt"    TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TenantPayout_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TenantPayout_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "TenantPayout_tenantId_idx" ON "TenantPayout"("tenantId");

-- Seed default countries (idempotent)
INSERT INTO "Country" ("code","name","phoneCode","currency") VALUES
  ('SN', '{"fr":"Sénégal","en":"Senegal"}',         '+221', 'XOF'),
  ('CI', '{"fr":"Côte d''Ivoire","en":"Ivory Coast"}','+225','XOF'),
  ('ML', '{"fr":"Mali","en":"Mali"}',                '+223', 'XOF'),
  ('GN', '{"fr":"Guinée","en":"Guinea"}',            '+224', 'GNF'),
  ('MA', '{"fr":"Maroc","en":"Morocco"}',            '+212', 'MAD'),
  ('TN', '{"fr":"Tunisie","en":"Tunisia"}',          '+216', 'TND'),
  ('FR', '{"fr":"France","en":"France"}',            '+33',  'EUR'),
  ('BE', '{"fr":"Belgique","en":"Belgium"}',         '+32',  'EUR'),
  ('LU', '{"fr":"Luxembourg","en":"Luxembourg"}',    '+352', 'EUR'),
  ('US', '{"fr":"États-Unis","en":"United States"}', '+1',   'USD'),
  ('GB', '{"fr":"Royaume-Uni","en":"United Kingdom"}','+44', 'GBP')
ON CONFLICT ("code") DO NOTHING;

-- Seed default cities (idempotent)
INSERT INTO "City" ("id","name","slug","countryCode") VALUES
  ('city_dakar',      '{"fr":"Dakar","en":"Dakar"}',           'dakar',      'SN'),
  ('city_thies',      '{"fr":"Thiès","en":"Thiès"}',           'thies',      'SN'),
  ('city_abidjan',    '{"fr":"Abidjan","en":"Abidjan"}',       'abidjan',    'CI'),
  ('city_bamako',     '{"fr":"Bamako","en":"Bamako"}',         'bamako',     'ML'),
  ('city_conakry',    '{"fr":"Conakry","en":"Conakry"}',       'conakry',    'GN'),
  ('city_casablanca', '{"fr":"Casablanca","en":"Casablanca"}', 'casablanca', 'MA'),
  ('city_rabat',      '{"fr":"Rabat","en":"Rabat"}',           'rabat',      'MA'),
  ('city_tunis',      '{"fr":"Tunis","en":"Tunis"}',           'tunis',      'TN'),
  ('city_paris',      '{"fr":"Paris","en":"Paris"}',           'paris',      'FR'),
  ('city_lyon',       '{"fr":"Lyon","en":"Lyon"}',             'lyon',       'FR'),
  ('city_bruxelles',  '{"fr":"Bruxelles","en":"Brussels"}',    'bruxelles',  'BE'),
  ('city_luxembourg', '{"fr":"Luxembourg","en":"Luxembourg"}', 'luxembourg', 'LU'),
  ('city_london',     '{"fr":"Londres","en":"London"}',        'london',     'GB'),
  ('city_new_york',   '{"fr":"New York","en":"New York"}',     'new-york',   'US')
ON CONFLICT ("id") DO NOTHING;
