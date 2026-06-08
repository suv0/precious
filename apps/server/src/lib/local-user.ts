import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { users, settings } from '../db/schema.js';

export const LOCAL_USER_ID = 'local-default';

export function isLocalPasswordEnabled(): boolean {
  return Boolean(process.env.PRECIOUS_LOCAL_PASSWORD?.trim());
}

export async function getOrCreateLocalUserId(): Promise<string> {
  const db = getDb();
  const [existing] = await db.select({ id: users.id }).from(users).limit(1);
  if (existing) return existing.id;

  const userId = LOCAL_USER_ID;
  const passwordHash = await bcrypt.hash('local-no-auth-placeholder', 12);

  await db.insert(users).values({
    id: userId,
    passwordHash,
    createdAt: new Date(),
  });

  await db.insert(settings).values({
    userId,
    tosAcknowledged: false,
    cloudTrustAcknowledged: false,
  });

  return userId;
}

export async function ensureLocalUser(): Promise<string> {
  const userId = await getOrCreateLocalUserId();
  const db = getDb();
  const [existingSettings] = await db
    .select({ userId: settings.userId })
    .from(settings)
    .where(eq(settings.userId, userId))
    .limit(1);

  if (!existingSettings) {
    await db.insert(settings).values({
      userId,
      tosAcknowledged: false,
      cloudTrustAcknowledged: false,
    });
  }

  return userId;
}
