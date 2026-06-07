import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';

export const UNIFIED_KEY_PREFIX = 'prec_';
const BCRYPT_ROUNDS = 12;

export function generateUnifiedApiKey(): { key: string; prefix: string; hash: string } {
  const random = randomBytes(24).toString('base64url');
  const key = `${UNIFIED_KEY_PREFIX}${random}`;
  const prefix = key.slice(0, 12);
  const hash = hashUnifiedApiKey(key);
  return { key, prefix, hash };
}

export function hashUnifiedApiKey(key: string): string {
  return bcrypt.hashSync(key, BCRYPT_ROUNDS);
}

export function verifyUnifiedApiKey(key: string, hash: string): boolean {
  if (!key.startsWith(UNIFIED_KEY_PREFIX)) return false;
  return bcrypt.compareSync(key, hash);
}

export function maskApiKey(key: string): string {
  if (key.length <= 12) return '••••••••';
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}
