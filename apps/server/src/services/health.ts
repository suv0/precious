import { eq } from 'drizzle-orm';
import { decrypt, healthFromError, type KeyHealthStatus } from '@precious/core';
import { getDefaultModels } from '@precious/providers';
import type { Db } from '../db/index.js';
import { providerKeys } from '../db/schema.js';

function getAdapter(providerId: string) {
  return getAllAdapters().find((a) => a.id === providerId);
}

export async function updateKeyHealth(
  db: Db,
  keyId: string,
  status: KeyHealthStatus,
): Promise<void> {
  await db
    .update(providerKeys)
    .set({ healthStatus: status, lastCheckedAt: new Date() })
    .where(eq(providerKeys.id, keyId));
}

export async function probeProviderKey(
  db: Db,
  keyId: string,
  encryptionKey: string,
): Promise<KeyHealthStatus> {
  const [row] = await db.select().from(providerKeys).where(eq(providerKeys.id, keyId)).limit(1);
  if (!row) return 'unknown';

  const adapter = getAdapter(row.providerId);
  if (!adapter) {
    await updateKeyHealth(db, keyId, 'unknown');
    return 'unknown';
  }

  try {
    const apiKey = decrypt(row.encryptedKey, encryptionKey);
    const model =
      row.providerId === 'groq'
        ? 'llama-3.3-70b-versatile'
        : row.providerId === 'openrouter'
          ? 'meta-llama/llama-3.3-70b-instruct:free'
          : getDefaultModels(row.providerId)[0] ?? 'default';

    await adapter.chatCompletion(
      apiKey,
      model,
      { messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 },
      row.customBaseUrl,
    );

    await updateKeyHealth(db, keyId, 'healthy');
    return 'healthy';
  } catch (err) {
    const status = healthFromError(err);
    await updateKeyHealth(db, keyId, status);
    return status;
  }
}

export async function probeAllUserKeys(
  db: Db,
  userId: string,
  encryptionKey: string,
): Promise<void> {
  const rows = await db
    .select({ id: providerKeys.id })
    .from(providerKeys)
    .where(eq(providerKeys.userId, userId));

  for (const row of rows) {
    await probeProviderKey(db, row.id, encryptionKey);
  }
}
