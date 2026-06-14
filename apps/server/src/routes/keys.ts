import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { encrypt, generateUnifiedApiKey } from '@precious/core';
import { LOCAL_PROVIDERS, getProviderMeta, getDefaultModels, KEYLESS_SENTINEL } from '@precious/providers';
import { getDb } from '../db/index.js';
import {
  providerKeys,
  unifiedApiKeys,
  settings,
  fallbackChain,
  keyUsageCounters,
  auditLog,
} from '../db/schema.js';
import { logAudit } from '../lib/utils.js';
import { ensureFallbackChainForKeys } from '../lib/fallback-chain.js';
import { localApiAuth, type AppVariables } from '../middleware/auth.js';

const keys = new Hono<{ Variables: AppVariables }>();

async function ensureUserSettings(userId: string) {
  const db = getDb();
  const [row] = await db
    .select({ userId: settings.userId })
    .from(settings)
    .where(eq(settings.userId, userId))
    .limit(1);

  if (!row) {
    await db.insert(settings).values({
      userId,
      tosAcknowledged: false,
      cloudTrustAcknowledged: false,
    });
  }
}

async function patchUserSettings(
  userId: string,
  patch: { tosAcknowledged?: boolean; cloudTrustAcknowledged?: boolean },
) {
  await ensureUserSettings(userId);
  const db = getDb();
  if (Object.keys(patch).length > 0) {
    await db.update(settings).set(patch).where(eq(settings.userId, userId));
  }
}

keys.use('*', localApiAuth);

keys.get('/providers', (c) => {
  return c.json({ providers: LOCAL_PROVIDERS });
});

keys.get('/', async (c) => {
  const userId = c.get('userId');
  const db = getDb();
  const rows = await db
    .select({
      id: providerKeys.id,
      providerId: providerKeys.providerId,
      label: providerKeys.label,
      customBaseUrl: providerKeys.customBaseUrl,
      healthStatus: providerKeys.healthStatus,
      createdAt: providerKeys.createdAt,
    })
    .from(providerKeys)
    .where(eq(providerKeys.userId, userId));

  const enriched = rows.map((row) => ({
    ...row,
    meta: getProviderMeta(row.providerId),
  }));

  return c.json({ keys: enriched });
});

keys.post('/', async (c) => {
  const userId = c.get('userId');
  const db = getDb();
  const encryptionKey = process.env.ENCRYPTION_KEY!;
  const body = await c.req.json<{
    providerId: string;
    label: string;
    apiKey: string;
    customBaseUrl?: string;
    tosAcknowledged?: boolean;
    cloudTrustAcknowledged?: boolean;
  }>();

  if (!body.providerId || !body.label) {
    return c.json({ error: 'providerId and label are required' }, 400);
  }

  const meta = getProviderMeta(body.providerId);
  if (!meta) {
    return c.json({ error: 'Unknown provider' }, 400);
  }

  const rawKey = body.apiKey?.trim() ?? '';
  if (!rawKey && !meta.keyless) {
    return c.json({ error: 'providerId, label, and apiKey are required' }, 400);
  }

  const apiKey = rawKey || KEYLESS_SENTINEL;

  const [userSettings] = await db
    .select()
    .from(settings)
    .where(eq(settings.userId, userId))
    .limit(1);

  if (!userSettings?.tosAcknowledged && !body.tosAcknowledged) {
    return c.json(
      {
        error: 'Terms of Service acknowledgment required before adding keys',
        code: 'tos_required',
        tosRequired: true,
      },
      403,
    );
  }

  if (
    process.env.PRECIOUS_CLOUD_MODE === '1' &&
    !userSettings?.cloudTrustAcknowledged &&
    !body.cloudTrustAcknowledged
  ) {
    return c.json(
      {
        error: 'Cloud trust acknowledgment required before adding keys',
        code: 'cloud_trust_required',
        cloudTrustRequired: true,
      },
      403,
    );
  }

  if (body.tosAcknowledged) {
    await patchUserSettings(userId, { tosAcknowledged: true });
  }

  if (body.cloudTrustAcknowledged) {
    await patchUserSettings(userId, { cloudTrustAcknowledged: true });
  }

  const id = uuidv4();
  const encryptedKey = encrypt(apiKey, encryptionKey);

  await db.insert(providerKeys).values({
    id,
    userId,
    providerId: body.providerId,
    label: body.label,
    encryptedKey,
    customBaseUrl: body.customBaseUrl?.trim() || null,
    healthStatus: 'unknown',
    createdAt: new Date(),
  });

  const existingChain = await db
    .select({ providerId: fallbackChain.providerId })
    .from(fallbackChain)
    .where(eq(fallbackChain.userId, userId));

  const hasProvider = existingChain.some((r) => r.providerId === body.providerId);
  if (!hasProvider) {
    const maxPriority = existingChain.length;
    const defaultModel = getDefaultModels(body.providerId)[0] ?? 'default';
    await db.insert(fallbackChain).values({
      id: uuidv4(),
      userId,
      providerId: body.providerId,
      model: defaultModel,
      priority: maxPriority,
      enabled: true,
    });
  }

  await logAudit(db, userId, 'key_created', {
    resourceType: 'provider_key',
    resourceId: id,
    metadata: { providerId: body.providerId, label: body.label },
  });

  return c.json({
    id,
    providerId: body.providerId,
    label: body.label,
    meta,
  });
});

keys.patch('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const db = getDb();
  const encryptionKey = process.env.ENCRYPTION_KEY!;
  const body = await c.req.json<{
    apiKey: string;
    label?: string;
    customBaseUrl?: string | null;
  }>();

  if (!body.apiKey?.trim()) {
    return c.json({ error: 'apiKey is required' }, 400);
  }

  const [existing] = await db
    .select()
    .from(providerKeys)
    .where(and(eq(providerKeys.id, id), eq(providerKeys.userId, userId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Key not found' }, 404);
  }

  const encryptedKey = encrypt(body.apiKey.trim(), encryptionKey);
  const patch: {
    encryptedKey: string;
    healthStatus: string;
    label?: string;
    customBaseUrl?: string | null;
  } = {
    encryptedKey,
    healthStatus: 'unknown',
  };

  if (body.label !== undefined) patch.label = body.label.trim() || existing.label;
  if (body.customBaseUrl !== undefined) {
    patch.customBaseUrl = body.customBaseUrl?.trim() || null;
  }

  await db.update(providerKeys).set(patch).where(eq(providerKeys.id, id));

  await db.delete(keyUsageCounters).where(eq(keyUsageCounters.providerKeyId, id));

  await logAudit(db, userId, 'key_updated', {
    resourceType: 'provider_key',
    resourceId: id,
    metadata: { providerId: existing.providerId },
  });

  return c.json({
    id,
    providerId: existing.providerId,
    label: patch.label ?? existing.label,
    meta: getProviderMeta(existing.providerId),
  });
});

keys.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const db = getDb();

  await db
    .delete(providerKeys)
    .where(and(eq(providerKeys.id, id), eq(providerKeys.userId, userId)));

  await logAudit(db, userId, 'key_deleted', {
    resourceType: 'provider_key',
    resourceId: id,
  });

  return c.json({ ok: true });
});

keys.get('/unified', async (c) => {
  const userId = c.get('userId');
  const db = getDb();
  const rows = await db
    .select({
      id: unifiedApiKeys.id,
      keyPrefix: unifiedApiKeys.keyPrefix,
      createdAt: unifiedApiKeys.createdAt,
    })
    .from(unifiedApiKeys)
    .where(eq(unifiedApiKeys.userId, userId));

  return c.json({ keys: rows });
});

keys.post('/unified', async (c) => {
  const userId = c.get('userId');
  const db = getDb();

  const [providerKey] = await db
    .select({ id: providerKeys.id })
    .from(providerKeys)
    .where(eq(providerKeys.userId, userId))
    .limit(1);

  if (!providerKey) {
    return c.json(
      {
        error: 'Add at least one provider key before generating a unified key.',
        code: 'no_provider_keys',
      },
      400,
    );
  }

  const { key, prefix, hash } = generateUnifiedApiKey();
  const id = uuidv4();

  await db.insert(unifiedApiKeys).values({
    id,
    userId,
    keyHash: hash,
    keyPrefix: prefix,
    createdAt: new Date(),
  });

  await logAudit(db, userId, 'unified_key_created', {
    resourceType: 'unified_api_key',
    resourceId: id,
    metadata: { prefix },
  });

  return c.json({
    key,
    prefix,
    message: 'Your prec_ key is forged. Guard it — you only see it once.',
  });
});

keys.get('/usage', async (c) => {
  const userId = c.get('userId');
  const db = getDb();
  const { getUsageSummaryForUser } = await import('../lib/usage-summary.js');
  const summary = await getUsageSummaryForUser(db, userId);
  return c.json(summary);
});

keys.get('/settings', async (c) => {
  const userId = c.get('userId');
  await ensureUserSettings(userId);
  const db = getDb();
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.userId, userId))
    .limit(1);

  return c.json({
    tosAcknowledged: row?.tosAcknowledged ?? false,
    cloudTrustAcknowledged: row?.cloudTrustAcknowledged ?? false,
  });
});

keys.post('/:id/test', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const db = getDb();
  const encryptionKey = process.env.ENCRYPTION_KEY!;

  const [existing] = await db
    .select({ id: providerKeys.id })
    .from(providerKeys)
    .where(and(eq(providerKeys.id, id), eq(providerKeys.userId, userId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Key not found' }, 404);
  }

  const { probeProviderKey, keyProbeMessage } = await import('../services/health.js');
  const probe = await probeProviderKey(db, id, encryptionKey);

  const [row] = await db
    .select({
      id: providerKeys.id,
      providerId: providerKeys.providerId,
      label: providerKeys.label,
      customBaseUrl: providerKeys.customBaseUrl,
      healthStatus: providerKeys.healthStatus,
      createdAt: providerKeys.createdAt,
    })
    .from(providerKeys)
    .where(eq(providerKeys.id, id))
    .limit(1);

  const key = row
    ? {
        ...row,
        meta: getProviderMeta(row.providerId),
      }
    : null;

  return c.json({
    ok: probe.status === 'healthy',
    healthStatus: probe.status,
    message: keyProbeMessage(probe.status, probe.errorMessage),
    key,
  });
});

keys.post('/health-check', async (c) => {
  const userId = c.get('userId');
  const db = getDb();
  const encryptionKey = process.env.ENCRYPTION_KEY!;
  const { probeAllUserKeys } = await import('../services/health.js');
  await probeAllUserKeys(db, userId, encryptionKey);

  const rows = await db
    .select({
      id: providerKeys.id,
      providerId: providerKeys.providerId,
      label: providerKeys.label,
      customBaseUrl: providerKeys.customBaseUrl,
      healthStatus: providerKeys.healthStatus,
      createdAt: providerKeys.createdAt,
    })
    .from(providerKeys)
    .where(eq(providerKeys.userId, userId));

  const enriched = rows.map((row) => ({
    ...row,
    meta: getProviderMeta(row.providerId),
  }));

  return c.json({ keys: enriched });
});

keys.get('/audit', async (c) => {
  const userId = c.get('userId');
  const db = getDb();
  const rows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      resourceType: auditLog.resourceType,
      resourceId: auditLog.resourceId,
      metadata: auditLog.metadata,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .where(eq(auditLog.userId, userId))
    .orderBy(desc(auditLog.createdAt))
    .limit(200);

  const entries = rows.map((row) => ({
    id: row.id,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    metadata: tryParseMeta(row.metadata),
    createdAt: row.createdAt.toISOString(),
  }));

  return c.json({ entries });
});

function tryParseMeta(meta: string | null): Record<string, unknown> | null {
  if (!meta) return null;
  try {
    return JSON.parse(meta);
  } catch {
    return null;
  }
}

export { keys };
