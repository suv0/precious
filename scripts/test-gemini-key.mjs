#!/usr/bin/env node
/**
 * Test Gemini API key — validates key, lists models, probes chat.
 *
 * Usage:
 *   GEMINI_API_KEY=your_key node scripts/test-gemini-key.mjs
 *   node scripts/test-gemini-key.mjs --from-db   # key saved in Precious SQLite
 */
import { createClient } from '@libsql/client';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decrypt } from '../packages/core/dist/encryption.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OPENAI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai';

const CHAT_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-1.5-flash', // deprecated — often 404 on v1beta OpenAI-compat API
];

async function loadKeyFromDb() {
  const dataDir = join(ROOT, 'apps/server/data');
  const envPath = join(dataDir, '.env.local');
  const dbPath = join(dataDir, 'precious.db');

  if (!existsSync(envPath)) {
    throw new Error(`Missing ${envPath} — run Precious once to generate ENCRYPTION_KEY`);
  }
  if (!existsSync(dbPath)) {
    throw new Error(`Missing ${dbPath} — add a Gemini key in the panel first`);
  }

  const match = readFileSync(envPath, 'utf8').match(/ENCRYPTION_KEY=(.+)/);
  const encryptionKey = match?.[1]?.trim();
  if (!encryptionKey) throw new Error('ENCRYPTION_KEY not found in .env.local');

  const client = createClient({ url: `file:${dbPath.replace(/\\/g, '/')}` });
  const result = await client.execute(
    "SELECT encrypted_key FROM provider_keys WHERE provider_id = 'google-gemini' LIMIT 1",
  );
  const row = result.rows[0];

  if (!row) {
    throw new Error('No google-gemini key in provider_keys — add one in Keys panel');
  }

  const apiKey = decrypt(String(row.encrypted_key), encryptionKey);
  console.log('Loaded Gemini key from Precious DB (apps/server/data/precious.db)\n');
  return apiKey.trim();
}

async function resolveApiKey() {
  if (process.argv.includes('--from-db')) {
    return loadKeyFromDb();
  }
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    console.error('Usage:');
    console.error('  GEMINI_API_KEY=your_key node scripts/test-gemini-key.mjs');
    console.error('  node scripts/test-gemini-key.mjs --from-db');
    process.exit(1);
  }
  return key;
}

function parseErrorBody(text) {
  try {
    const j = JSON.parse(text);
    if (Array.isArray(j) && j[0]?.error) return j[0].error;
    if (j.error) return j.error;
    return j;
  } catch {
    return { message: text.slice(0, 300) };
  }
}

async function validateKey(apiKey) {
  const res = await fetch(`${OPENAI_BASE}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const text = await res.text();
  const err = parseErrorBody(text);

  if (!res.ok) {
    console.log(`Key check: FAILED (${res.status})`);
    console.log(`  ${err.message ?? text.slice(0, 200)}`);
    if (res.status === 400) {
      console.log('\nThis is an invalid API key — create one at https://aistudio.google.com/apikey');
      console.log('Keys usually start with AIza…');
    }
    return null;
  }

  let modelIds = [];
  try {
    const j = JSON.parse(text);
    modelIds = (j.data ?? []).map((m) => m.id).filter(Boolean);
  } catch {
    /* ignore */
  }

  console.log(`Key check: OK (${modelIds.length} models visible via OpenAI-compat API)\n`);
  if (modelIds.length) {
    console.log('Sample models:', modelIds.slice(0, 8).join(', '), modelIds.length > 8 ? '…' : '');
    console.log('');
  }
  return modelIds;
}

async function testChat(apiKey, model) {
  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
      max_tokens: 16,
    }),
  });
  const text = await res.text();
  const err = parseErrorBody(text);

  if (res.ok) {
    try {
      const j = JSON.parse(text);
      const reply = j.choices?.[0]?.message?.content ?? '(empty)';
      return { ok: true, summary: `OK — "${reply.trim().slice(0, 40)}"` };
    } catch {
      return { ok: true, summary: 'OK' };
    }
  }

  const msg = String(err.message ?? text).slice(0, 220);
  const limitZero = /limit:\s*0/i.test(msg);
  let note = '';
  if (res.status === 500 && /internal error/i.test(msg)) {
    note = ' [often = bad key or unsupported model name on chat endpoint]';
  } else if (limitZero) {
    note = ' [limit 0 = model not on your free tier, not exhausted quota]';
  }
  return { ok: false, summary: `${res.status} — ${msg}${note}` };
}

const apiKey = await resolveApiKey();

if (!apiKey.startsWith('AIza')) {
  console.warn('Warning: key does not start with AIza — may not be a Google AI Studio key.\n');
}

console.log(`Key prefix: ${apiKey.slice(0, 8)}… (${apiKey.length} chars)\n`);

const modelIds = await validateKey(apiKey);
if (!modelIds) process.exit(1);

console.log('Chat completion tests (same endpoint Precious uses):\n');
for (const model of CHAT_MODELS) {
  const r = await testChat(apiKey, model);
  console.log(`${model.padEnd(24)} ${r.summary}`);
}

console.log('\nTips:');
console.log('  • All 500 on chat but key check failed → invalid GEMINI_API_KEY (Google returns misleading 500 on chat).');
console.log('  • Test the key saved in Precious: node scripts/test-gemini-key.mjs --from-db');
console.log('  • PowerShell: $env:GEMINI_API_KEY="AIza…"; node scripts/test-gemini-key.mjs');
console.log('  • Use gemini-2.5-flash in Keys → Fallback chain (1.5.x is deprecated on this API).');
