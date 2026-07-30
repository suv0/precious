import { eq, asc, desc, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage } from '@precious/core';
import { getDb } from '../db/index.js';
import { chatMessages, conversations } from '../db/schema.js';

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

export interface ConversationEntry {
  id: string;
  title: string;
  model?: string | null;
  provider?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function loadChatMessages(
  userId: string,
  conversationId: string,
): Promise<Array<ChatMessage & { meta?: MessageMeta }>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.userId, userId),
        eq(chatMessages.conversationId, conversationId),
      ),
    )
    .orderBy(asc(chatMessages.createdAt));

  return rows.map((r) => ({
    role: r.role as ChatMessage['role'],
    content: parseStoredContent(r.content ?? ''),
    ...(r.meta ? { meta: JSON.parse(r.meta) as MessageMeta } : {}),
  }));
}

export async function getConversationEntries(userId: string): Promise<ConversationEntry[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt));

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    model: r.model,
    provider: r.provider,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function createConversation(
  userId: string,
  title?: string,
): Promise<ConversationEntry> {
  const db = getDb();
  const id = uuidv4();
  const now = new Date();
  await db.insert(conversations).values({
    id,
    userId,
    title: title?.trim() || 'New Chat',
    createdAt: now,
    updatedAt: now,
  });
  return {
    id,
    title: title?.trim() || 'New Chat',
    model: null,
    provider: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateConversationMeta(
  userId: string,
  conversationId: string,
  data: { title?: string; model?: string; provider?: string },
): Promise<void> {
  const db = getDb();
  await db
    .update(conversations)
    .set({
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.model !== undefined ? { model: data.model } : {}),
      ...(data.provider !== undefined ? { provider: data.provider } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)));
}

export async function deleteConversation(userId: string, conversationId: string): Promise<void> {
  const db = getDb();
  await db
    .delete(chatMessages)
    .where(and(eq(chatMessages.conversationId, conversationId), eq(chatMessages.userId, userId)));
  await db
    .delete(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)));
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

export function mergeChatMessages(
  stored: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] {
  if (incoming.length > 0) return incoming;
  return stored;
}

export async function saveChatMessages(
  userId: string,
  conversationId: string,
  messages: ChatMessage[],
  messageMeta?: Map<number, MessageMeta>,
): Promise<void> {
  const db = getDb();
  await db
    .delete(chatMessages)
    .where(
      and(
        eq(chatMessages.userId, userId),
        eq(chatMessages.conversationId, conversationId),
      ),
    );

  const now = Date.now();
  for (let i = 0; i < messages.length; i += 1) {
    const msg = messages[i];
    const meta = messageMeta?.get(i);
    await db.insert(chatMessages).values({
      id: uuidv4(),
      userId,
      conversationId,
      role: msg.role,
      content: serializeContent(msg.content),
      meta: meta ? JSON.stringify(meta) : null,
      createdAt: new Date(now + i),
    });
  }

  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));
}

export async function clearChatMessages(userId: string, conversationId: string): Promise<void> {
  const db = getDb();
  await db
    .delete(chatMessages)
    .where(
      and(
        eq(chatMessages.userId, userId),
        eq(chatMessages.conversationId, conversationId),
      ),
    );
}
