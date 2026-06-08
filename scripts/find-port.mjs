import { createServer } from 'node:net';

function isPortFree(port) {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once('error', () => resolve(false));
    probe.listen(port, () => {
      probe.close(() => resolve(true));
    });
  });
}

/**
 * @param {number} start
 * @param {number} [maxAttempts=20]
 * @param {Set<number>} [reserved] ports already chosen (e.g. API port when picking web port)
 */
export async function findAvailablePort(start, maxAttempts = 20, reserved = new Set()) {
  for (let port = start; port < start + maxAttempts; port++) {
    if (reserved.has(port)) continue;
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port found in range ${start}–${start + maxAttempts - 1}`);
}
