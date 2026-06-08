export type KeyHealthStatus = 'healthy' | 'rate_limited' | 'invalid' | 'unknown';

/** Default per-key limits aligned with typical free-tier hobby use */
export const DEFAULT_KEY_RATE_LIMITS = {
  requestsPerMinute: 30,
  requestsPerDay: 14_400,
} as const;

/** Map upstream HTTP/auth errors to health status */
export function healthFromError(err: unknown): KeyHealthStatus {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  if (msg.includes('401') || msg.includes('403') || msg.includes('invalid') || msg.includes('unauthorized')) {
    return 'invalid';
  }
  if (msg.includes('429') || msg.includes('rate limit')) {
    return 'rate_limited';
  }
  return 'unknown';
}

export function isKeyHealthyForRouting(status: KeyHealthStatus | null | undefined): boolean {
  return status === 'healthy' || status === 'unknown' || status == null;
}
