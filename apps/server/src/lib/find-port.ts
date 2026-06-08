import { createServer } from 'node:net';

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once('error', () => resolve(false));
    probe.listen(port, () => {
      probe.close(() => resolve(true));
    });
  });
}

/** Pick the first free port starting at `start` (dev fallback when preferred port is taken). */
export async function findAvailablePort(
  start: number,
  maxAttempts = 20,
): Promise<number> {
  for (let port = start; port < start + maxAttempts; port++) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port found in range ${start}–${start + maxAttempts - 1}`);
}
