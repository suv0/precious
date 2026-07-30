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
    provider_key_id TEXT NOT NULL REFERENCES provider_keys(id) ON DELETE CASCADE,
    model TEXT NOT NULL DEFAULT '*',
    minute_count INTEGER NOT NULL DEFAULT 0,
    minute_window_start INTEGER NOT NULL,
    day_count INTEGER NOT NULL DEFAULT 0,
    day_window_start INTEGER NOT NULL,
    tokens_today INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (provider_key_id, model)
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
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Chat',
    model TEXT,
    provider TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT,
    meta TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS oauth_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_account_id TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_chat_messages_lookup ON chat_messages (user_id, conversation_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_unified_keys_prefix ON unified_api_keys (key_prefix);
`;

const LEGACY_ALTERS = [
  'ALTER TABLE users ADD COLUMN email TEXT',
  'ALTER TABLE users ADD COLUMN name TEXT',
  'ALTER TABLE users ADD COLUMN github_id TEXT',
  'ALTER TABLE users ADD COLUMN image TEXT',
  'ALTER TABLE provider_keys ADD COLUMN health_status TEXT DEFAULT \'unknown\'',
  'ALTER TABLE provider_keys ADD COLUMN last_checked_at INTEGER',
  'ALTER TABLE settings ADD COLUMN cloud_trust_acknowledged INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE key_usage_counters ADD COLUMN tokens_today INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE key_usage_counters ADD COLUMN model TEXT NOT NULL DEFAULT \'*\'',
  'ALTER TABLE chat_messages ADD COLUMN meta TEXT',
  'ALTER TABLE chat_messages ADD COLUMN conversation_id TEXT',
];

/** Handle key_usage_counters PK migration from single-column to composite. */
export async function migrateKeyUsageCountersPK(execute: (sql: string) => unknown | Promise<unknown>) {
  try {
    // Check if the old table still has a single-column PK
    const result = await execute(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='key_usage_counters'"
    );
    const rows = result as unknown as { rows?: Array<{ sql: string }> } | undefined;
    const ddl = rows?.rows?.[0]?.sql ?? '';
    // Old schema has "provider_key_id TEXT PRIMARY KEY" (single column)
    // New schema has "PRIMARY KEY (provider_key_id, model)" (composite)
    if (ddl.includes('PRIMARY KEY (provider_key_id, model)') || ddl.includes('PRIMARY KEY("provider_key_id", "model")')) {
      return; // already migrated
    }
    // Recreate with composite PK
    await execute('DROP TABLE key_usage_counters');
    await execute(`
      CREATE TABLE key_usage_counters (
        provider_key_id TEXT NOT NULL REFERENCES provider_keys(id) ON DELETE CASCADE,
        model TEXT NOT NULL DEFAULT '*',
        minute_count INTEGER NOT NULL DEFAULT 0,
        minute_window_start INTEGER NOT NULL,
        day_count INTEGER NOT NULL DEFAULT 0,
        day_window_start INTEGER NOT NULL,
        PRIMARY KEY (provider_key_id, model)
      )
    `);
  } catch {
    /* best effort — new installs get the right schema from MIGRATION_SQL */
  }
}

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
