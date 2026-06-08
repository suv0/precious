import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema.js';
import { MIGRATION_SQL, migrateLegacyColumns } from './migrate.js';

export type PreciousDb = Awaited<ReturnType<typeof createPreciousDb>>;

export async function createPreciousDb(url: string, authToken?: string) {
  const client = createClient(
    authToken ? { url, authToken } : { url },
  );
  const db = drizzle(client, { schema });

  for (const stmt of MIGRATION_SQL.split(';').filter((s) => s.trim())) {
    await client.execute(stmt);
  }
  await migrateLegacyColumns((sql) => client.execute(sql));

  return db;
}

export { schema };
