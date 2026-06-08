import { Hono } from 'hono';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { sessions } from '../db/schema.js';
import {
  createSessionToken,
  logAudit,
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
} from '../lib/utils.js';
import {
  getOrCreateLocalUserId,
  isLocalPasswordEnabled,
} from '../lib/local-user.js';
import { sessionAuth, type AppVariables } from '../middleware/auth.js';

const auth = new Hono<{ Variables: AppVariables }>();

auth.get('/status', async (c) => {
  const passwordEnabled = isLocalPasswordEnabled();
  return c.json({
    setupRequired: false,
    authRequired: passwordEnabled,
    passwordProtection: passwordEnabled,
    mode: 'local',
  });
});

auth.post('/setup', async (c) => {
  if (!isLocalPasswordEnabled()) {
    const userId = await getOrCreateLocalUserId();
    return c.json({ ok: true, userId, authRequired: false });
  }
  return c.json(
    {
      error: 'Password protection uses PRECIOUS_LOCAL_PASSWORD env var — use /login',
    },
    400,
  );
});

auth.post('/login', async (c) => {
  if (!isLocalPasswordEnabled()) {
    const userId = await getOrCreateLocalUserId();
    return c.json({ ok: true, userId, authRequired: false });
  }

  const body = await c.req.json<{ password: string }>();
  const expected = process.env.PRECIOUS_LOCAL_PASSWORD!.trim();

  if (body.password !== expected) {
    return c.json({ error: 'Invalid password' }, 401);
  }

  const userId = await getOrCreateLocalUserId();
  const sessionId = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);
  const db = getDb();

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt,
    createdAt: new Date(),
  });

  await logAudit(db, userId, 'login');

  setCookie(c, SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });

  return c.json({ ok: true });
});

auth.post('/logout', sessionAuth, async (c) => {
  const db = getDb();
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    await db.delete(sessions).where(eq(sessions.id, token));
  }
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ ok: true });
});

/** Cloud only — delete account and all data (cascade) */
auth.delete('/account', sessionAuth, async (c) => {
  if (process.env.PRECIOUS_CLOUD_MODE !== '1') {
    return c.json({ error: 'Account deletion is only available in cloud mode' }, 404);
  }

  const userId = c.get('userId');
  const db = getDb();
  const { users } = await import('../db/schema.js');

  await logAudit(db, userId, 'login', { metadata: { action: 'account_delete' } });
  await db.delete(users).where(eq(users.id, userId));

  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ ok: true, message: 'Account and all keys deleted.' });
});

export { auth };
