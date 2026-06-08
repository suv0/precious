import { eq } from 'drizzle-orm';
import { decrypt, healthFromError, type KeyHealthStatus } from '@precious/core';
import { getAllAdapters, getDefaultModels, verifyOpenRouterKey } from '@precious/providers';
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

export interface KeyProbeResult {
  status: KeyHealthStatus;
  errorMessage?: string;
}

export function keyProbeMessage(status: KeyHealthStatus, errorMessage?: string): string {
  if (status === 'healthy') {
    return errorMessage ?? 'Key responded to a minimal chat request.';
  }
  if (errorMessage) {
    const short = errorMessage.length > 120 ? `${errorMessage.slice(0, 117)}…` : errorMessage;
    if (status === 'rate_limited' && short.toLowerCase().includes('openrouter')) {
      return `${short} Free models share capacity — your key may still work in Chat.`;
    }
    return short;
  }
  switch (status) {
    case 'rate_limited':
      return 'Rate limited — key may be valid but quota is exhausted.';
    case 'invalid':
      return 'Invalid or unauthorized — check the API key.';
    default:
      return 'Could not verify — provider returned an unexpected error.';
  }
}

export async function probeProviderKey(
  db: Db,
  keyId: string,
  encryptionKey: string,
): Promise<KeyProbeResult> {
  const [row] = await db.select().from(providerKeys).where(eq(providerKeys.id, keyId)).limit(1);
  if (!row) return { status: 'unknown' };

  const adapter = getAdapter(row.providerId);
  if (!adapter) {
    await updateKeyHealth(db, keyId, 'unknown');
    return { status: 'unknown' };
  }

  try {
    const apiKey = decrypt(row.encryptedKey, encryptionKey);

    if (row.providerId === 'openrouter') {
      const detail = await verifyOpenRouterKey(apiKey);
      await updateKeyHealth(db, keyId, 'healthy');
      return { status: 'healthy', errorMessage: detail };
    }

    const model =
      row.providerId === 'groq'
        ? 'llama-3.3-70b-versatile'
        : getDefaultModels(row.providerId)[0] ?? 'default';

    await adapter.chatCompletion(
      apiKey,
      model,
      { messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 },
      row.customBaseUrl,
    );

    await updateKeyHealth(db, keyId, 'healthy');
    return { status: 'healthy' };
  } catch (err) {
    const status = healthFromError(err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    await updateKeyHealth(db, keyId, status);
    return { status, errorMessage };
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
