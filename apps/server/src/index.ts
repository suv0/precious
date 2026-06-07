import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateEncryptionKey } from '@precious/core';
import { initDb } from './db/index.js';
import { ensureLocalUser } from './lib/local-user.js';
import { auth } from './routes/auth.js';
import { keys } from './routes/keys.js';
import { fallback } from './routes/fallback.js';
import { v1, chatSession } from './routes/chat.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3001);
const DATA_DIR = process.env.DATA_DIR ?? join(process.cwd(), 'data');
const DB_PATH = process.env.DATABASE_PATH ?? join(DATA_DIR, 'precious.db');
const WEB_DIST = process.env.WEB_DIST ?? join(process.cwd(), '..', 'web', 'out');

function ensureEnv() {
  const envPath = join(DATA_DIR, '.env.local');
  if (!process.env.ENCRYPTION_KEY) {
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, 'utf8');
      const match = content.match(/ENCRYPTION_KEY=(.+)/);
      if (match) process.env.ENCRYPTION_KEY = match[1].trim();
    }
  }

  if (!process.env.ENCRYPTION_KEY) {
    const key = generateEncryptionKey();
    process.env.ENCRYPTION_KEY = key;
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
    writeFileSync(
      envPath,
      `# Auto-generated on first run — back this up!\nENCRYPTION_KEY=${key}\n`,
      'utf8',
    );
    console.log(`Generated ENCRYPTION_KEY and saved to ${envPath}`);
  }
}

async function main() {
  ensureEnv();
  initDb(DB_PATH);
  await ensureLocalUser();

  const app = new Hono();

  app.use(
    '*',
    cors({
      origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        process.env.WEB_ORIGIN ?? '',
      ].filter(Boolean),
      credentials: true,
    }),
  );

  app.get('/health', (c) => c.json({ status: 'ok', mode: 'local' }));

  app.route('/api/auth', auth);
  app.route('/api/keys', keys);
  app.route('/api/fallback-chain', fallback);
  app.route('/v1', v1);
  app.route('/api/chat', chatSession);

  if (existsSync(WEB_DIST)) {
    app.use('/*', serveStatic({ root: WEB_DIST }));
    app.get('*', serveStatic({ path: join(WEB_DIST, 'index.html') }));
  } else if (process.env.NODE_ENV !== 'production') {
    app.get('/', (c) =>
      c.json({
        message: 'Precious Local API',
        tagline: 'One key to rule them all.',
        web: 'Run npm run dev:web for UI at http://localhost:3000',
        docs: '/health',
      }),
    );
  }

  console.log(`
  ╔═══════════════════════════════════════╗
  ║           💎 Precious Local           ║
  ║   One key to rule them all.           ║
  ╚═══════════════════════════════════════╝
  API:  http://localhost:${PORT}
  Mode: local (SQLite @ ${DB_PATH})
  `);

  serve({ fetch: app.fetch, port: PORT });
}

main().catch(console.error);
