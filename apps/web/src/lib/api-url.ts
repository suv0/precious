import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Resolve the Precious API server URL (dev auto-port file or env). */
export function resolveApiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  const portFile = join(process.cwd(), '../server/data/.dev-port');
  try {
    if (existsSync(portFile)) {
      const port = readFileSync(portFile, 'utf8').trim();
      if (port) return `http://localhost:${port}`;
    }
  } catch {
    /* fall through */
  }
  return 'http://localhost:3001';
}

/** Response headers the panel reads for routing metadata. */
export const PRECIOUS_RESPONSE_HEADERS = [
  'x-precious-provider',
  'x-precious-model',
  'x-precious-tokens',
  'x-precious-trail',
  'x-precious-conversation',
  'x-failover-from',
  'x-routed-via',
] as const;

export function copyPreciousHeaders(upstream: Response, target: Headers): void {
  for (const name of PRECIOUS_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) target.set(name, value);
  }
  const contentType = upstream.headers.get('content-type');
  if (contentType) target.set('Content-Type', contentType);
  const cacheControl = upstream.headers.get('cache-control');
  if (cacheControl) target.set('Cache-Control', cacheControl);
}
