import { eq, asc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage } from '@precious/core';
import { getDb } from '../db/index.js';
import { chatMessages } from '../db/schema.js';

export interface MessageMeta {
  provider?: string;
  model?: string;
  tokens?: number;
  trail?: Array<{
    provider: string;
    model: string;
    result: 'success' | 'error' | 'skipped';
    error?: string;
    skipped?: string;
  }>;
}

export async function loadChatMessages(userId: string): Promise<Array<ChatMessage & { meta?: MessageMeta }>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.userId, userId))
    .orderBy(asc(chatMessages.createdAt));

  return rows.map((r) => ({
    role: r.role as ChatMessage['role'],
    content: parseStoredContent(r.content ?? ''),
    ...(r.meta ? { meta: JSON.parse(r.meta) as MessageMeta } : {}),
  }));
}

function parseStoredContent(raw: string): ChatMessage['content'] {
  if (raw.startsWith('[')) {
    try {
      return JSON.parse(raw) as ChatMessage['content'];
    } catch {
      return raw;
    }
  }
  return raw;
}

function serializeContent(content: ChatMessage['content']): string {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  return JSON.stringify(content);
}

/**
 * useChat sends the full thread the user sees — that list is authoritative.
 * Old server-side merge kept stale DB history when the client had fewer messages
 * (e.g. after refresh), which caused replies unrelated to what was on screen.
 */
export function mergeChatMessages(
  stored: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] {
  if (incoming.length > 0) return incoming;
  return stored;
}

export async function saveChatMessages(
  userId: string,
  messages: ChatMessage[],
  messageMeta?: Map<number, MessageMeta>,
): Promise<void> {
  const db = getDb();
  await db.delete(chatMessages).where(eq(chatMessages.userId, userId));

  const now = Date.now();
  for (let i = 0; i < messages.length; i += 1) {
    const msg = messages[i];
    const meta = messageMeta?.get(i);
    await db.insert(chatMessages).values({
      id: uuidv4(),
      userId,
      role: msg.role,
      content: serializeContent(msg.content),
      meta: meta ? JSON.stringify(meta) : null,
      createdAt: new Date(now + i),
    });
  }
}

export async function clearChatMessages(userId: string): Promise<void> {
  const db = getDb();
  await db.delete(chatMessages).where(eq(chatMessages.userId, userId));
}
