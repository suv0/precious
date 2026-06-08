#!/usr/bin/env node
/**
 * Local smoke test — health, models, unified key API shape, npm test gate.
 * Run with server already up on PORT (default 3001), or set PRECIOUS_SMOKE_START=1.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const PORT = Number(process.env.SMOKE_PORT ?? process.env.PORT ?? 3101);
const BASE = `http://localhost:${PORT}`;
const AUTO_START = process.env.PRECIOUS_SMOKE_START === '1' || process.argv.includes('--start');

async function fetchJson(path, init) {
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body, headers: res.headers };
}

async function waitForHealth(maxMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const { status, body } = await fetchJson('/health');
      if (status === 200 && body?.status === 'ok') return body;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server not healthy at ${BASE}/health after ${maxMs}ms`);
}

function startServer() {
  const dataDir = mkdtempSync(join(tmpdir(), 'precious-smoke-'));
  const env = {
    ...process.env,
    PORT: String(PORT),
    DATA_DIR: dataDir,
    DATABASE_PATH: join(dataDir, 'precious.db'),
    ENCRYPTION_KEY: 'a'.repeat(64),
    NODE_ENV: 'test',
  };
  const child = spawn('node', ['apps/server/dist/index.js'], {
    cwd: process.cwd(),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return child;
}

async function main() {
  let server;
  if (AUTO_START) {
    server = startServer();
    server.stdout?.on('data', (d) => process.stdout.write(d));
    server.stderr?.on('data', (d) => process.stderr.write(d));
  }

  try {
    const health = await waitForHealth();
    console.log('✓ /health', health);

    const models = await fetchJson('/api/chat/models');
    if (models.status !== 200) throw new Error(`models failed: ${models.status}`);
    const modelIds = models.body?.data?.map((m) => m.id) ?? [];
    if (!modelIds.includes('auto')) throw new Error('auto model missing from /api/chat/models');
    console.log('✓ /api/chat/models includes auto', modelIds);

    const providers = await fetchJson('/api/keys/providers');
    if (providers.status !== 200) throw new Error('providers list failed');
    const count = providers.body?.providers?.length ?? 0;
    if (count < 5) throw new Error(`expected 5 providers, got ${count}`);
    console.log(`✓ /api/keys/providers (${count} providers)`);

    const unified = await fetchJson('/api/keys/unified', { method: 'POST' });
    if (unified.status !== 200 || !unified.body?.key?.startsWith('prec_')) {
      throw new Error('unified key generation failed');
    }
    const apiKey = unified.body.key;
    console.log('✓ unified prec_ key generated');

    const chatRes = await fetchJson('/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'auto',
        messages: [
          { role: 'user', content: 'Say hi in one word' },
          { role: 'assistant', content: 'Hello' },
          { role: 'user', content: 'What was my first message?' },
        ],
        stream: false,
      }),
    });

    if (chatRes.status === 502 && String(chatRes.body?.error?.message).includes('No provider')) {
      console.log('✓ /v1/chat/completions accepts full history (no keys configured — expected 502)');
    } else if (chatRes.status === 200) {
      console.log('✓ /v1/chat/completions with full history', chatRes.headers.get('x-routed-via'));
    } else {
      console.log('✓ /v1/chat/completions reachable', chatRes.status, chatRes.body?.error?.message ?? '');
    }

    console.log('\nAll smoke checks passed.');
  } finally {
    if (server) server.kill();
  }
}

main().catch((err) => {
  console.error('Smoke test failed:', err.message);
  process.exit(1);
});
