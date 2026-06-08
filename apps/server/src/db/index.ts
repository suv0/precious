import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { schema, MIGRATION_SQL, migrateLegacyColumns } from '@precious/db';

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function setDb(db: ReturnType<typeof drizzle<typeof schema>>) {
  dbInstance = db;
}

export async function initDb(dbPath: string) {
  const { mkdirSync, existsSync } = await import('node:fs');
  const { dirname } = await import('node:path');

  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const absolutePath = dbPath.replace(/\\/g, '/');
  const client = createClient({ url: `file:${absolutePath}` });
  dbInstance = drizzle(client, { schema });

  await runMigrations(client);
  return dbInstance;
}

async function runMigrations(client: ReturnType<typeof createClient>) {
  for (const stmt of MIGRATION_SQL.split(';').filter((s) => s.trim())) {
    await client.execute(stmt);
  }
  await migrateLegacyColumns((sql) => client.execute(sql));
}

export function getDb() {
  if (!dbInstance) {
    throw new Error('Database not initialized');
  }
  return dbInstance;
}

export type Db = ReturnType<typeof getDb>;

export * from '@precious/db';
