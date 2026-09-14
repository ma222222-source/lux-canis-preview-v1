ALTER TABLE users ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN credential_tag TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS security_limits (
  key_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_security_limits_expiry ON security_limits(expires_at);
