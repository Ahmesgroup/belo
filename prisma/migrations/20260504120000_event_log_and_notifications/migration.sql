-- Migration: event_log_and_notifications
-- Adds EventLog (event persistence + retry) and AdminNotification (admin inbox)

-- CreateTable EventLog
CREATE TABLE IF NOT EXISTS "EventLog" (
    "id"          TEXT NOT NULL,
    "type"        TEXT NOT NULL,
    "payload"     JSONB NOT NULL,
    "status"      TEXT NOT NULL DEFAULT 'pending',
    "retries"     INTEGER NOT NULL DEFAULT 0,
    "maxRetries"  INTEGER NOT NULL DEFAULT 3,
    "error"       TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EventLog_status_createdAt_idx" ON "EventLog"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "EventLog_type_createdAt_idx"   ON "EventLog"("type",   "createdAt");

-- CreateTable AdminNotification
CREATE TABLE IF NOT EXISTS "AdminNotification" (
    "id"        TEXT NOT NULL,
    "type"      TEXT NOT NULL,
    "title"     TEXT NOT NULL,
    "body"      TEXT,
    "tenantId"  TEXT,
    "metadata"  JSONB,
    "read"      BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdminNotification_read_createdAt_idx" ON "AdminNotification"("read", "createdAt");
