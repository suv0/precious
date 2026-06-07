import { Hono } from 'hono';
import { eq, asc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import { fallbackChain } from '../db/schema.js';
import { localApiAuth, type AppVariables } from '../middleware/auth.js';
import type { FallbackChainEntry } from '@precious/core';

const fallback = new Hono<{ Variables: AppVariables }>();

fallback.use('*', localApiAuth);

fallback.get('/', async (c) => {
  const userId = c.get('userId');
  const db = getDb();
  const rows = await db
    .select()
    .from(fallbackChain)
    .where(eq(fallbackChain.userId, userId))
    .orderBy(asc(fallbackChain.priority));

  const chain: FallbackChainEntry[] = rows.map((r) => ({
    providerId: r.providerId as FallbackChainEntry['providerId'],
    model: r.model,
    priority: r.priority,
    enabled: r.enabled,
  }));

  return c.json({ chain });
});

fallback.put('/', async (c) => {
  const userId = c.get('userId');
  const db = getDb();
  const body = await c.req.json<{ chain: FallbackChainEntry[] }>();

  if (!Array.isArray(body.chain)) {
    return c.json({ error: 'chain array required' }, 400);
  }

  await db.delete(fallbackChain).where(eq(fallbackChain.userId, userId));

  for (const entry of body.chain) {
    await db.insert(fallbackChain).values({
      id: uuidv4(),
      userId,
      providerId: entry.providerId,
      model: entry.model,
      priority: entry.priority,
      enabled: entry.enabled,
    });
  }

  return c.json({ ok: true, count: body.chain.length });
});

export { fallback };
