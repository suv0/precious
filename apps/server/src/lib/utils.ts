import { randomBytes } from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { Db } from '../db/index.js';
import { auditLog } from '../db/schema.js';
import type { AuditAction } from '@precious/core';

export async function logAudit(
  db: Db,
  userId: string,
  action: AuditAction,
  opts?: {
    resourceType?: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await db.insert(auditLog).values({
    id: uuidv4(),
    userId,
    action,
    resourceType: opts?.resourceType ?? null,
    resourceId: opts?.resourceId ?? null,
    metadata: opts?.metadata ? JSON.stringify(sanitizeMetadata(opts.metadata)) : null,
    createdAt: new Date(),
  });
}

function sanitizeMetadata(meta: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    const key = k.toLowerCase();
    if (key.includes('key') || key.includes('password') || key.includes('secret')) continue;
    safe[k] = v;
  }
  return safe;
}

export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export const SESSION_COOKIE = 'precious_session';
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export { eq, and };

export function validateCustomBaseUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return 'Invalid base URL. Must be a valid HTTPS URL (e.g. https://api.example.com/v1).';
  }

  if (url.pathname && !url.pathname.endsWith('/')) {
    url.pathname = url.pathname + '/';
  }

  const hostname = url.hostname.toLowerCase();

  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return null;
    }
    return 'Localhost base URLs must use http:// or https://.';
  }

  if (url.protocol !== 'https:') {
    return 'Base URL must use HTTPS. Only localhost (http://localhost:*) is allowed without TLS.';
  }

  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return 'IP addresses are not allowed in base URLs. Use a hostname.';
  }

  return null;
}
