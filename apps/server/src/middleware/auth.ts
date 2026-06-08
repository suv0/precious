import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { eq, and, gt } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { sessions, users } from '../db/schema.js';
import { SESSION_COOKIE } from '../lib/utils.js';
import {
  getOrCreateLocalUserId,
  isLocalPasswordEnabled,
} from '../lib/local-user.js';

export type AppVariables = {
  userId: string;
};

async function resolveSessionUserId(token: string): Promise<string | null> {
  const db = getDb();
  const now = new Date();
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, token), gt(sessions.expiresAt, now)))
    .limit(1);

  return session?.userId ?? null;
}

export async function sessionAuth(c: Context, next: Next) {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const userId = await resolveSessionUserId(token);
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  c.set('userId', userId);
  await next();
}

export async function optionalSessionAuth(c: Context, next: Next) {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    const userId = await resolveSessionUserId(token);
    if (userId) {
      c.set('userId', userId);
    }
  }
  await next();
}

/**
 * Local API auth: no login by default; optional PRECIOUS_LOCAL_PASSWORD protection.
 * Cloud mode (PRECIOUS_CLOUD_MODE=1): always requires valid session cookie.
 */
export async function localApiAuth(c: Context, next: Next) {
  if (process.env.PRECIOUS_CLOUD_MODE === '1') {
    return sessionAuth(c, next);
  }

  if (!isLocalPasswordEnabled()) {
    const userId = await getOrCreateLocalUserId();
    c.set('userId', userId);
    await next();
    return;
  }

  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    const userId = await resolveSessionUserId(token);
    if (userId) {
      c.set('userId', userId);
      await next();
      return;
    }
  }

  return c.json({ error: 'Unauthorized', authRequired: true }, 401);
}

export async function unifiedKeyAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json(
      {
        error: {
          message: 'You shall not pass… without a valid API key.',
          type: 'invalid_request_error',
        },
      },
      401,
    );
  }

  const apiKey = authHeader.slice(7);
  const { verifyUnifiedApiKey } = await import('@precious/core');
  const db = getDb();
  const { unifiedApiKeys } = await import('../db/schema.js');

  const keys = await db.select().from(unifiedApiKeys);
  let matchedUserId: string | null = null;

  for (const record of keys) {
    if (verifyUnifiedApiKey(apiKey, record.keyHash)) {
      matchedUserId = record.userId;
      break;
    }
  }

  if (!matchedUserId) {
    return c.json(
      {
        error: {
          message: 'You shall not pass… without a valid API key.',
          type: 'invalid_request_error',
        },
      },
      401,
    );
  }

  c.set('userId', matchedUserId);
  await next();
}

export async function requireSetup(c: Context, next: Next) {
  const db = getDb();
  const allUsers = await db.select({ id: users.id }).from(users).limit(1);
  if (allUsers.length === 0) {
    return c.json({ error: 'Setup required', setupRequired: true }, 503);
  }
  await next();
}
