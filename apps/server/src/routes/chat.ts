import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import type { Context } from 'hono';
import { eq, asc } from 'drizzle-orm';
import {
  Router,
  decrypt,
  RateLimitLedger,
  type ChatCompletionRequest,
} from '@precious/core';
import { getAllAdapters, LOCAL_PROVIDERS, getDefaultModels } from '@precious/providers';
import { getDb } from '../db/index.js';
import { providerKeys, fallbackChain } from '../db/schema.js';
import { logAudit } from '../lib/utils.js';
import {
  loadChatMessages,
  mergeChatMessages,
  saveChatMessages,
} from '../lib/chat-messages.js';
import { localApiAuth, unifiedKeyAuth, type AppVariables } from '../middleware/auth.js';

const router = new Router(getAllAdapters());
const rateLimiter = new RateLimitLedger({ requestsPerMinute: 60 });

const v1 = new Hono<{ Variables: AppVariables }>();

async function loadUserContext(userId: string) {
  const db = getDb();
  const encryptionKey = process.env.ENCRYPTION_KEY!;

  const keys = await db
    .select()
    .from(providerKeys)
    .where(eq(providerKeys.userId, userId));

  let chainRows = await db
    .select()
    .from(fallbackChain)
    .where(eq(fallbackChain.userId, userId))
    .orderBy(asc(fallbackChain.priority));

  if (chainRows.length === 0 && keys.length > 0) {
    chainRows = keys.map((k, i) => ({
      id: '',
      userId,
      providerId: k.providerId,
      model: getDefaultModels(k.providerId)[0] ?? 'default',
      priority: i,
      enabled: true,
    }));
  }

  return {
    userId,
    fallbackChain: chainRows.map((r) => ({
      providerId: r.providerId as never,
      model: r.model,
      priority: r.priority,
      enabled: r.enabled,
    })),
    providerKeys: keys.map((k) => ({
      id: k.id,
      providerId: k.providerId as never,
      label: k.label,
      encryptedKey: k.encryptedKey,
      customBaseUrl: k.customBaseUrl,
    })),
    decryptKey: (encrypted: string) => decrypt(encrypted, encryptionKey),
  };
}

function setRoutingHeaders(
  c: Context,
  provider: string,
  model: string,
  failoverFrom?: string,
) {
  c.header('X-Precious-Provider', provider);
  c.header('X-Precious-Model', model);
  c.header('X-Routed-Via', provider);
  if (failoverFrom) {
    c.header('X-Failover-From', failoverFrom);
  }
}

async function handleChat(
  c: Context<{ Variables: AppVariables }>,
  useStoredMessages: boolean,
) {
  const userId = c.get('userId');
  const limit = rateLimiter.check(userId);
  if (!limit.allowed) {
    return c.json(
      {
        error: {
          message: 'Rate limit exceeded. Second breakfast? Second fallback provider.',
          type: 'rate_limit_error',
        },
      },
      429,
    );
  }

  const body = await c.req.json<ChatCompletionRequest>();
  if (!body.messages?.length) {
    return c.json({ error: { message: 'messages required' } }, 400);
  }

  let messages = body.messages;
  if (useStoredMessages) {
    const stored = await loadChatMessages(userId);
    messages = mergeChatMessages(stored, body.messages);
  }

  const requestBody: ChatCompletionRequest = {
    ...body,
    messages,
  };

  await saveChatMessages(userId, messages);

  const ctx = await loadUserContext(userId);
  const db = getDb();

  await logAudit(db, userId, 'chat_request', {
    metadata: { model: body.model, stream: body.stream ?? false },
  });

  for (const key of ctx.providerKeys) {
    await logAudit(db, userId, 'key_accessed', {
      resourceType: 'provider_key',
      resourceId: key.id,
    });
  }

  const wantsStream = body.stream === true;

  try {
    const result = await router.route(ctx, requestBody, wantsStream);

    if (wantsStream && result.stream) {
      c.header('Content-Type', 'text/event-stream');
      c.header('Cache-Control', 'no-cache');
      c.header('Connection', 'keep-alive');
      setRoutingHeaders(c, result.provider, result.model, result.failoverFrom);

      return stream(c, async (s) => {
        for await (const chunk of result.stream!) {
          await s.write(chunk);
        }
      });
    }

    setRoutingHeaders(c, result.provider, result.model, result.failoverFrom);
    return c.json(result.response);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Routing failed';
    return c.json({ error: { message, type: 'api_error' } }, 502);
  }
}

v1.post('/chat/completions', unifiedKeyAuth, (c) => handleChat(c, false));
v1.get('/models', unifiedKeyAuth, async (c) => {
  const userId = c.get('userId');
  const ctx = await loadUserContext(userId);
  const models = ctx.fallbackChain
    .filter((e) => e.enabled)
    .map((e) => ({
      id: e.model,
      object: 'model' as const,
      owned_by: e.providerId,
      precious: LOCAL_PROVIDERS.find((p) => p.id === e.providerId),
    }));

  return c.json({ object: 'list', data: models });
});

export const chatSession = new Hono<{ Variables: AppVariables }>();
chatSession.post('/completions', localApiAuth, (c) => handleChat(c, true));
chatSession.get('/models', localApiAuth, async (c) => {
  const userId = c.get('userId');
  const ctx = await loadUserContext(userId);
  const models = ctx.fallbackChain
    .filter((e) => e.enabled)
    .map((e) => ({
      id: e.model,
      object: 'model' as const,
      owned_by: e.providerId,
    }));

  return c.json({ object: 'list', data: models });
});

export { v1 };
