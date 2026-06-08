export const MIGRATION_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT,
    name TEXT,
    github_id TEXT,
    image TEXT,
    password_hash TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS provider_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_id TEXT NOT NULL,
    label TEXT NOT NULL,
    encrypted_key TEXT NOT NULL,
    custom_base_url TEXT,
    health_status TEXT DEFAULT 'unknown',
    last_checked_at INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS key_usage_counters (
    provider_key_id TEXT PRIMARY KEY REFERENCES provider_keys(id) ON DELETE CASCADE,
    minute_count INTEGER NOT NULL DEFAULT 0,
    minute_window_start INTEGER NOT NULL,
    day_count INTEGER NOT NULL DEFAULT 0,
    day_window_start INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS unified_api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS fallback_chain (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_id TEXT NOT NULL,
    model TEXT NOT NULL,
    priority INTEGER NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS settings (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    tos_acknowledged INTEGER NOT NULL DEFAULT 0,
    cloud_trust_acknowledged INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    metadata TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS oauth_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_account_id TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`;

const LEGACY_ALTERS = [
  'ALTER TABLE users ADD COLUMN email TEXT',
  'ALTER TABLE users ADD COLUMN name TEXT',
  'ALTER TABLE users ADD COLUMN github_id TEXT',
  'ALTER TABLE users ADD COLUMN image TEXT',
  'ALTER TABLE provider_keys ADD COLUMN health_status TEXT DEFAULT \'unknown\'',
  'ALTER TABLE provider_keys ADD COLUMN last_checked_at INTEGER',
  'ALTER TABLE settings ADD COLUMN cloud_trust_acknowledged INTEGER NOT NULL DEFAULT 0',
];

export async function migrateLegacyColumns(
  execute: (sql: string) => unknown | Promise<unknown>,
): Promise<void> {
  for (const sql of LEGACY_ALTERS) {
    try {
      await execute(sql);
    } catch {
      /* column may already exist */
    }
  }
}
