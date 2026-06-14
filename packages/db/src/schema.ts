import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email'),
  name: text('name'),
  githubId: text('github_id'),
  image: text('image'),
  passwordHash: text('password_hash'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const providerKeys = sqliteTable('provider_keys', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  providerId: text('provider_id').notNull(),
  label: text('label').notNull(),
  encryptedKey: text('encrypted_key').notNull(),
  customBaseUrl: text('custom_base_url'),
  healthStatus: text('health_status').default('unknown'),
  lastCheckedAt: integer('last_checked_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const keyUsageCounters = sqliteTable('key_usage_counters', {
  providerKeyId: text('provider_key_id')
    .notNull()
    .references(() => providerKeys.id, { onDelete: 'cascade' }),
  model: text('model').notNull().default('*'),
  minuteCount: integer('minute_count').notNull().default(0),
  minuteWindowStart: integer('minute_window_start').notNull(),
  dayCount: integer('day_count').notNull().default(0),
  dayWindowStart: integer('day_window_start').notNull(),
  tokensToday: integer('tokens_today').notNull().default(0),
}, (table) => ({
  pk: primaryKey({ columns: [table.providerKeyId, table.model] }),
}));

export const unifiedApiKeys = sqliteTable('unified_api_keys', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  keyHash: text('key_hash').notNull(),
  keyPrefix: text('key_prefix').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const fallbackChain = sqliteTable('fallback_chain', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  providerId: text('provider_id').notNull(),
  model: text('model').notNull(),
  priority: integer('priority').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
});

export const settings = sqliteTable('settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  tosAcknowledged: integer('tos_acknowledged', { mode: 'boolean' })
    .notNull()
    .default(false),
  cloudTrustAcknowledged: integer('cloud_trust_acknowledged', { mode: 'boolean' })
    .notNull()
    .default(false),
});

export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  resourceType: text('resource_type'),
  resourceId: text('resource_id'),
  metadata: text('metadata'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default('New Chat'),
  model: text('model'),
  provider: text('provider'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  conversationId: text('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content'),
  meta: text('meta'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const oauthAccounts = sqliteTable('oauth_accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
