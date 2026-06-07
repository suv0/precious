import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { encrypt, generateUnifiedApiKey } from '@precious/core';
import { LOCAL_PROVIDERS, getProviderMeta, getDefaultModels } from '@precious/providers';
import { getDb } from '../db/index.js';
import { providerKeys, unifiedApiKeys, settings, fallbackChain } from '../db/schema.js';
import { logAudit } from '../lib/utils.js';
import { localApiAuth, type AppVariables } from '../middleware/auth.js';

const keys = new Hono<{ Variables: AppVariables }>();

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
  }>();

  if (!body.providerId || !body.label || !body.apiKey) {
    return c.json({ error: 'providerId, label, and apiKey are required' }, 400);
  }

  const meta = getProviderMeta(body.providerId);
  if (!meta) {
    return c.json({ error: 'Unknown provider' }, 400);
  }

  const [userSettings] = await db
    .select()
    .from(settings)
    .where(eq(settings.userId, userId))
    .limit(1);

  if (!userSettings?.tosAcknowledged && !body.tosAcknowledged) {
    return c.json(
      {
        error: 'Terms of Service acknowledgment required before adding keys',
        tosRequired: true,
      },
      403,
    );
  }

  if (body.tosAcknowledged) {
    await db
      .update(settings)
      .set({ tosAcknowledged: true })
      .where(eq(settings.userId, userId));
  }

  const id = uuidv4();
  const encryptedKey = encrypt(body.apiKey, encryptionKey);

  await db.insert(providerKeys).values({
    id,
    userId,
    providerId: body.providerId,
    label: body.label,
    encryptedKey,
    customBaseUrl: body.customBaseUrl ?? null,
    createdAt: new Date(),
  });

  const existingChain = await db
    .select()
    .from(fallbackChain)
    .where(eq(fallbackChain.userId, userId))
    .limit(1);

  if (existingChain.length === 0) {
    const defaultModel = getDefaultModels(body.providerId)[0] ?? 'default';
    await db.insert(fallbackChain).values({
      id: uuidv4(),
      userId,
      providerId: body.providerId,
      model: defaultModel,
      priority: 0,
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
    message: 'Save this key now — it will not be shown again.',
  });
});

keys.get('/settings', async (c) => {
  const userId = c.get('userId');
  const db = getDb();
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.userId, userId))
    .limit(1);

  return c.json({
    tosAcknowledged: row?.tosAcknowledged ?? false,
  });
});

export { keys };
