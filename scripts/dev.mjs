#!/usr/bin/env node
/**
 * Start API + web dev servers, auto-picking free ports when defaults are taken.
 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { findAvailablePort } from './find-port.mjs';

const root = process.cwd();
const dataDir = join(root, 'apps/server/data');
const portFile = join(dataDir, '.dev-port');

const PREFERRED_API = Number(process.env.PORT ?? 3001);
const PREFERRED_WEB = Number(process.env.WEB_PORT ?? 3000);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHealth(port, maxMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`http://localhost:${port}/health`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await sleep(200);
  }
  throw new Error(`API server not healthy on port ${port}`);
}

function npmRun(args, env) {
  const cmd = `npm ${args.join(' ')}`;
  return spawn(cmd, { cwd: root, stdio: 'inherit', env, shell: true });
}

let server;
let web;

function shutdown(code = 0) {
  if (web) web.kill();
  if (server) server.kill();
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));

try {
  const apiPort = await findAvailablePort(PREFERRED_API);
  const webPort = await findAvailablePort(PREFERRED_WEB, 20, new Set([apiPort]));

  if (apiPort !== PREFERRED_API) {
    console.log(`API port ${PREFERRED_API} in use — using ${apiPort}`);
  }
  if (webPort !== PREFERRED_WEB) {
    console.log(`Web port ${PREFERRED_WEB} in use — using ${webPort}`);
  }

  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  writeFileSync(portFile, String(apiPort), 'utf8');

  const webOrigin = `http://localhost:${webPort}`;
  const apiUrl = `http://localhost:${apiPort}`;

  server = npmRun(['run', 'dev', '--workspace=@precious/server'], {
    ...process.env,
    PORT: String(apiPort),
    PRECIOUS_STRICT_PORT: '1',
    WEB_ORIGIN: webOrigin,
  });

  server.on('error', (err) => {
    console.error('Failed to start API:', err.message);
    shutdown(1);
  });
  server.on('exit', (code) => shutdown(code ?? 0));

  await waitForHealth(apiPort);

  console.log(`\nPanel: ${webOrigin}`);
  console.log(`API:   ${apiUrl}\n`);

  web = npmRun(['run', 'dev', '--workspace=@precious/web', '--', '-p', String(webPort)], {
    ...process.env,
    NEXT_PUBLIC_API_URL: apiUrl,
  });

  web.on('error', (err) => {
    console.error('Failed to start web:', err.message);
    shutdown(1);
  });
  web.on('exit', (code) => shutdown(code ?? 0));
} catch (err) {
  console.error(err.message);
  shutdown(1);
}
