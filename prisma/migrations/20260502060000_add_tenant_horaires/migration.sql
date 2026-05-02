-- Add horaires (opening hours) JSON column to Tenant
-- Stores [{ open, from, to }] × 7 days (Mon–Sun)

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "horaires" JSONB;
