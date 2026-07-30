import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateEncryptionKey } from '@precious/core';
import { initDb } from './db/index.js';
import { ensureLocalUser } from './lib/local-user.js';
import { createPreciousApp } from './create-app.js';
import { findAvailablePort } from './lib/find-port.js';

function getDefaultWebDist(): string {
  return process.env.WEB_DIST ?? join(process.cwd(), '..', 'web', 'out');
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const PREFERRED_PORT = Number(process.env.PORT ?? 3001);
const DATA_DIR = process.env.DATA_DIR ?? join(process.cwd(), 'data');
const DB_PATH = process.env.DATABASE_PATH ?? join(DATA_DIR, 'precious.db');
const WEB_DIST = getDefaultWebDist();
const DEV_PORT_FILE = join(DATA_DIR, '.dev-port');

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

async function resolveListenPort(): Promise<number> {
  const strict = process.env.PRECIOUS_STRICT_PORT === '1';
  const isDev = process.env.NODE_ENV !== 'production';

  if (strict || !isDev) {
    return PREFERRED_PORT;
  }

  const port = await findAvailablePort(PREFERRED_PORT);
  if (port !== PREFERRED_PORT) {
    console.log(`Port ${PREFERRED_PORT} in use — using ${port} instead`);
  }
  return port;
}

async function main() {
  ensureEnv();
  await initDb(DB_PATH);
  await ensureLocalUser();

  const port = await resolveListenPort();
  if (process.env.NODE_ENV !== 'production') {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(DEV_PORT_FILE, String(port), 'utf8');
  }

  const app = createPreciousApp({
    mode: 'local',
    webDist: WEB_DIST,
    corsOrigins: [
      'http://localhost:3000',
      `http://localhost:${port}`,
      process.env.WEB_ORIGIN ?? '',
    ].filter(Boolean),
  });

  if (existsSync(WEB_DIST)) {
    // Map clean URLs to .html files (Next.js static export convention)
    // e.g. /chat → chat.html, /settings/keys → settings/keys.html
    app.use('*', async (c, next) => {
      const url = new URL(c.req.url);
      const pathname = url.pathname;
      if (pathname.startsWith('/api/') || pathname.startsWith('/v1/') || pathname === '/health') {
        return next();
      }
      if (pathname.includes('.')) return next();

      const resolved = pathname.replace(/\/$/, '') || '/';
      const htmlFile = resolved === '/' ? 'index.html' : resolved.slice(1) + '.html';
      const fullPath = join(WEB_DIST, htmlFile);
      if (existsSync(fullPath)) {
        return c.html(readFileSync(fullPath, 'utf8'));
      }
      return next();
    });
    app.use('/*', serveStatic({ root: WEB_DIST }));
    app.get('*', serveStatic({ path: join(WEB_DIST, 'index.html') }));
  } else if (process.env.NODE_ENV !== 'production') {
    app.get('/', (c) => c.redirect('/settings/keys'));
  }

  const host = process.env.HOST ?? '127.0.0.1';

  console.log(`
  ╔═══════════════════════════════════════╗
  ║           💎 Precious Local           ║
  ║   One key to rule them all.           ║
  ╚═══════════════════════════════════════╝
  API + Panel: http://localhost:${port}
  Bind: ${host}:${port}
  Mode: local (SQLite @ ${DB_PATH})
  `);

  serve({ fetch: app.fetch, port, hostname: host });
}

main().catch(console.error);
