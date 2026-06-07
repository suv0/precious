import { eq, asc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage } from '@precious/core';
import { getDb } from '../db/index.js';
import { chatMessages } from '../db/schema.js';

export async function loadChatMessages(userId: string): Promise<ChatMessage[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.userId, userId))
    .orderBy(asc(chatMessages.createdAt));

  return rows.map((r) => ({
    role: r.role as ChatMessage['role'],
    content: r.content,
  }));
}

/** Prefer the longer history; DB fills gaps when the client sends only the latest turn. */
export function mergeChatMessages(
  stored: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] {
  if (incoming.length >= stored.length) return incoming;
  return stored;
}

export async function saveChatMessages(
  userId: string,
  messages: ChatMessage[],
): Promise<void> {
  const db = getDb();
  await db.delete(chatMessages).where(eq(chatMessages.userId, userId));

  const now = Date.now();
  for (let i = 0; i < messages.length; i += 1) {
    const msg = messages[i];
    await db.insert(chatMessages).values({
      id: uuidv4(),
      userId,
      role: msg.role,
      content: msg.content ?? '',
      createdAt: new Date(now + i),
    });
  }
}
