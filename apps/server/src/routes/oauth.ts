import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { RateLimitLedger } from '@precious/core';
import { getDb } from '../db/index.js';
import { users, settings, sessions, oauthAccounts } from '../db/schema.js';
import {
  createSessionToken,
  logAudit,
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
} from '../lib/utils.js';
import type { AppVariables } from '../middleware/auth.js';

const oauth = new Hono<{ Variables: AppVariables }>();
const signupRateLimiter = new RateLimitLedger({ requestsPerMinute: 10, requestsPerDay: 100 });

/**
 * Called from Precious Cloud web after GitHub OAuth.
 * Requires X-Precious-Auth-Secret header matching AUTH_SECRET.
 */
oauth.post('/sync', async (c) => {
  if (process.env.PRECIOUS_CLOUD_MODE !== '1') {
    return c.json({ error: 'OAuth sync is cloud-only' }, 404);
  }

  const secret = c.req.header('X-Precious-Auth-Secret');
  if (!secret || secret !== process.env.AUTH_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json<{
    email: string;
    name?: string;
    githubId: string;
    image?: string;
    website?: string;
  }>();

  if (body.website) {
    return c.json({ error: 'Rejected' }, 400);
  }

  if (!body.email || !body.githubId) {
    return c.json({ error: 'email and githubId required' }, 400);
  }

  const rateKey = `oauth:${body.githubId}`;
  const limit = signupRateLimiter.check(rateKey);
  if (!limit.allowed) {
    return c.json({ error: 'Too many signup attempts. Try again later.' }, 429);
  }

  const db = getDb();

  const [existingOAuth] = await db
    .select()
    .from(oauthAccounts)
    .where(eq(oauthAccounts.providerAccountId, body.githubId))
    .limit(1);

  let userId: string;

  if (existingOAuth) {
    userId = existingOAuth.userId;
  } else {
    userId = uuidv4();
    await db.insert(users).values({
      id: userId,
      email: body.email,
      name: body.name ?? null,
      githubId: body.githubId,
      image: body.image ?? null,
      passwordHash: null,
      createdAt: new Date(),
    });
    await db.insert(settings).values({
      userId,
      tosAcknowledged: false,
      cloudTrustAcknowledged: false,
    });
    await db.insert(oauthAccounts).values({
      id: uuidv4(),
      userId,
      provider: 'github',
      providerAccountId: body.githubId,
      createdAt: new Date(),
    });
  }

  const sessionId = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt,
    createdAt: new Date(),
  });

  await logAudit(db, userId, 'login', { metadata: { provider: 'github' } });

  setCookie(c, SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'None',
    path: '/',
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });

  return c.json({ ok: true, userId });
});

export { oauth };
