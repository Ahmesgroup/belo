-- ============================================================
-- Migration: replace compound unique on Booking(slotId, status)
-- with a partial unique index on slotId WHERE status IN (PENDING, CONFIRMED).
--
-- WHY:
--   The old @@unique([slotId, status]) allowed (slot, PENDING) and
--   (slot, CONFIRMED) to coexist — meaning one booking could be confirmed
--   while another pending one still existed for the same slot.
--   A partial index is the correct DB-level guarantee: at most one
--   ACTIVE (PENDING or CONFIRMED) booking per slot, ever.
--
-- The application still uses SELECT FOR UPDATE + double-check inside
-- the transaction as the primary lock; this index is the safety net.
-- ============================================================

-- Drop the old compound index (created by Prisma's @@unique)
DROP INDEX IF EXISTS "Booking_slotId_status_key";

-- Replace with a partial unique index — only one active booking per slot
CREATE UNIQUE INDEX "unique_active_booking_per_slot"
    ON "Booking" ("slotId")
    WHERE status IN ('PENDING', 'CONFIRMED');

-- Drop redundant index on idempotencyKey: @unique already creates one
DROP INDEX IF EXISTS "Booking_idempotencyKey_idx";
