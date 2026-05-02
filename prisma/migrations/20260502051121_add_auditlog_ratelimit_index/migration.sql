-- Add composite index on AuditLog for DB-based rate limiting
-- Speeds up: COUNT WHERE action='rate.hit' AND entityId=key AND createdAt > since

CREATE INDEX IF NOT EXISTS "AuditLog_action_entityId_createdAt_idx"
  ON "AuditLog"("action", "entityId", "createdAt");
