import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import type { Context } from 'hono';
import { eq, asc } from 'drizzle-orm';
import {
  Router,
  decrypt,
  RateLimitLedger,
  AUTO_MODEL,
  healthFromError,
  setLiveRateLimit,
  type ChatCompletionRequest,
  type EmbeddingRequest,
  type ProviderId,
  type MessageContentPart,
} from '@precious/core';
import { getAllAdapters, LOCAL_PROVIDERS, getDefaultModels, getModelAttachmentCapabilities } from '@precious/providers';
import { getDb } from '../db/index.js';
import { providerKeys, fallbackChain, conversations } from '../db/schema.js';
import { logAudit } from '../lib/utils.js';
import {
  loadChatMessages,
  mergeChatMessages,
  saveChatMessages,
  clearChatMessages,
  getConversationEntries,
  createConversation,
  deleteConversation,
  updateConversationMeta,
  type MessageMeta,
  type ConversationEntry,
} from '../lib/chat-messages.js';
import {
  hydrateKeyRateLedger,
  buildKeyAvailabilityChecker,
  loadKeyHealthMap,
  recordKeyUsage,
  recordKeyTokens,
  persistKeyUsage,
} from '../lib/key-usage.js';
import { updateKeyHealth } from '../services/health.js';
import { localApiAuth, unifiedKeyAuth, type AppVariables } from '../middleware/auth.js';
import { ensureFallbackChainForKeys } from '../lib/fallback-chain.js';

const router = new Router(
  getAllAdapters(),
  (providerId, model) => getModelAttachmentCapabilities(providerId, model),
);
const accountRateLimiter = new RateLimitLedger({ requestsPerMinute: 60 });
const apiRateLimiter = new RateLimitLedger({ requestsPerMinute: 120 });

const v1 = new Hono<{ Variables: AppVariables }>();

/** Models with no free-tier quota or deprecated IDs — auto-remap at route time. */
const GEMINI_MODEL_REMAP: Record<string, string> = {
  'gemini-2.0-flash': 'gemini-2.5-flash',
  'gemini-1.5-flash': 'gemini-2.5-flash',
  'gemini-1.5-pro': 'gemini-2.5-flash',
};

function resolveChainModel(providerId: string, model: string): string {
  if (providerId === 'google-gemini' && GEMINI_MODEL_REMAP[model]) {
    return GEMINI_MODEL_REMAP[model];
  }
  return model;
}

async function loadUserContext(userId: string) {
  const db = getDb();
  const encryptionKey = process.env.ENCRYPTION_KEY!;

  await ensureFallbackChainForKeys(db, userId);
  await hydrateKeyRateLedger(db, userId);
  const healthMap = await loadKeyHealthMap(db, userId);

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
      providerId: r.providerId as ProviderId,
      model: resolveChainModel(r.providerId, r.model),
      priority: r.priority,
      enabled: r.enabled,
    })),
    providerKeys: keys.map((k) => ({
      id: k.id,
      providerId: k.providerId as ProviderId,
      label: k.label,
      encryptedKey: k.encryptedKey,
      customBaseUrl: k.customBaseUrl?.trim() || undefined,
    })),
    decryptKey: (encrypted: string) => decrypt(encrypted, encryptionKey),
    isKeyAvailable: buildKeyAvailabilityChecker(db, healthMap),
  };
}

function listModels(ctx: Awaited<ReturnType<typeof loadUserContext>>) {
  const chainModels = ctx.fallbackChain
    .filter((e) => e.enabled)
    .map((e) => {
      const caps = getModelAttachmentCapabilities(e.providerId, e.model);
      return {
        id: e.model,
        object: 'model' as const,
        owned_by: e.providerId,
        supports_attachments: caps.images || caps.documents,
        supports_images: caps.images,
        supports_documents: caps.documents,
        precious: LOCAL_PROVIDERS.find((p) => p.id === e.providerId),
      };
    });

  if (chainModels.length === 0) {
    return [
      {
        id: AUTO_MODEL,
        object: 'model' as const,
        owned_by: 'precious',
        supports_attachments: false,
        supports_images: false,
        supports_documents: false,
      },
    ];
  }

  // Deduplicate same model id from different providers — keep both with unique keys in UI
  const seen = new Set<string>();
  const unique = chainModels.filter((m) => {
    const key = `${m.owned_by}:${m.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return [
    {
      id: AUTO_MODEL,
      object: 'model' as const,
      owned_by: 'precious',
      supports_attachments: unique.some((m) => m.supports_attachments),
      supports_images: unique.some((m) => m.supports_images),
      supports_documents: unique.some((m) => m.supports_documents),
    },
    ...unique,
  ];
}

function setRoutingHeaders(
  c: Context,
  provider: string,
  model: string,
  failoverFrom?: string,
  usage?: { total_tokens?: number },
  trail?: unknown,
  conversationId?: string,
) {
  c.header('X-Precious-Provider', provider);
  c.header('X-Precious-Model', model);
  c.header('X-Routed-Via', provider);
  if (failoverFrom) {
    c.header('X-Failover-From', failoverFrom);
  }
  if (usage?.total_tokens != null) {
    c.header('X-Precious-Tokens', String(usage.total_tokens));
  }
  if (trail) {
    c.header('X-Precious-Trail', JSON.stringify(trail));
  }
  if (conversationId) {
    c.header('X-Precious-Conversation', conversationId);
  }
}

interface StreamUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/** Estimate tokens from text using ~4 chars per token heuristic. */
function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

/** Wrap an SSE stream generator and extract any usage metadata found in chunks.
 *  Also accumulates output text for fallback token estimation. */
async function* interceptSSEUsage(
  stream: AsyncGenerator<string, void, unknown>,
  usageOut: { current: StreamUsage | null; outputText: string },
): AsyncGenerator<string, void, unknown> {
  for await (const chunk of stream) {
    yield chunk;
    for (const line of chunk.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data) as {
          usage?: StreamUsage;
          choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
        };
        if (parsed.usage) {
          usageOut.current = parsed.usage;
        }
        const text = parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.message?.content;
        if (text) usageOut.outputText += text;
      } catch {
        // skip
      }
    }
  }
}

/** OpenAI SSE chunks → plain text for panel useChat (streamProtocol: text).
 *  Also collects any usage metadata found in the stream chunks. */
async function* sseToPlainText(
  stream: AsyncGenerator<string, void, unknown>,
  usageOut: { current: StreamUsage | null },
): AsyncGenerator<string, void, unknown> {
  for await (const chunk of stream) {
    for (const line of chunk.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const parsed = JSON.parse(data) as {
          error?: { message?: string; code?: number | string } | string;
          choices?: Array<{
            delta?: { content?: string };
            message?: { content?: string };
          }>;
          usage?: StreamUsage;
        };
        if (parsed.error) {
          const err = parsed.error;
          const msg =
            typeof err === 'string'
              ? err
              : err.message ?? `Provider error ${err.code ?? ''}`.trim();
          throw new Error(msg || 'Provider returned a streaming error');
        }
        if (parsed.usage) {
          usageOut.current = parsed.usage;
        }
        const text =
          parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.message?.content;
        if (text) yield text;
      } catch (err) {
        if (err instanceof SyntaxError) continue;
        throw err;
      }
    }
  }
}

function messageContentToText(
  content: string | MessageContentPart[] | null | undefined,
): string {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  return content
    .filter((p) => p.type === 'text')
    .map((p) => p.text)
    .join('\n');
}

function buildMetaMap(assistantIndex: number, result: Awaited<ReturnType<Router['route']>>): Map<number, MessageMeta> {
  const usage = result.response?.usage;
  const meta: MessageMeta = {
    provider: result.provider,
    model: result.model,
    tokens: (usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0),
    trail: result.trail,
  };
  return new Map([[assistantIndex, meta]]);
}

async function handleChat(
  c: Context<{ Variables: AppVariables }>,
  useStoredMessages: boolean,
  isApiRoute: boolean,
) {
  const userId = c.get('userId');
  const panelMode = useStoredMessages;
  const limiter = isApiRoute ? apiRateLimiter : accountRateLimiter;
  const limit = limiter.check(userId);
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

  const body = await c.req.json<ChatCompletionRequest & { conversationId?: string }>();
  if (!body.messages?.length) {
    return c.json({ error: { message: 'messages required' } }, 400);
  }

  let conversationId = body.conversationId;

  let messages = body.messages;
  if (useStoredMessages && conversationId) {
    const stored = await loadChatMessages(userId, conversationId!);
    messages = mergeChatMessages(stored, body.messages);
  }

  const requestBody: ChatCompletionRequest = {
    ...body,
    messages,
    model: body.model || AUTO_MODEL,
    providerId: body.providerId,
  };

  // API mode: save incoming messages to conversation
  if (!panelMode && conversationId) {
    await saveChatMessages(userId, conversationId!, messages);
  }

  // Panel mode: auto-create conversation on first request if none provided
  if (panelMode && !conversationId) {
    const entry = await createConversation(userId);
    conversationId = entry.id;
  }

  // Auto-title from first user message if still "New Chat"
  if (panelMode && conversationId && messages.some((m) => m.role === 'user')) {
    const dbForTitle = getDb();
    const [current] = await dbForTitle
      .select({ title: conversations.title })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    if (current?.title === 'New Chat') {
      const firstUser = messages.find((m) => m.role === 'user');
      if (firstUser) {
        const firstContent = messageContentToText(firstUser.content);
        if (firstContent.trim()) {
          const title = firstContent.trim().length > 50
            ? firstContent.trim().slice(0, 47) + '...'
            : firstContent.trim();
          await updateConversationMeta(conversationId, { title });
        }
      }
    }
  }

  const ctx = await loadUserContext(userId);
  const db = getDb();

  const wantsStream = body.stream === true;
  let usedKeyId: string | undefined;

  try {
    const result = await router.route(ctx, requestBody, wantsStream);

    const usedKey = ctx.providerKeys.find((k) => k.providerId === result.provider);
    if (usedKey) {
      usedKeyId = usedKey.id;
      recordKeyUsage(result.provider, usedKey.id, result.model);
    }

    // Log routing decision with full provider/failover/token metadata
    await logAudit(db, userId, 'chat_request', {
      metadata: {
        provider: result.provider,
        model: result.model,
        failoverFrom: result.failoverFrom ?? null,
        attempts: result.attempts,
        tokens: (result.response?.usage?.prompt_tokens ?? 0) + (result.response?.usage?.completion_tokens ?? 0),
        stream: wantsStream,
        attachmentTypes: requestBody.attachmentTypes ?? null,
      },
    });

    // Record token usage from provider response
    const totalTokens = (result.response?.usage?.prompt_tokens ?? 0) + (result.response?.usage?.completion_tokens ?? 0);
    if (usedKey && totalTokens > 0) {
      recordKeyTokens(result.provider, usedKey.id, result.model, totalTokens);
    }

    // Persist usage + tokens together after both are recorded
    if (usedKey) {
      await persistKeyUsage(db, usedKey.id, result.provider, result.model);
    }

    // Store live rate limit headers for the QuotaCapacityBar
    const rateLimit = result.response?.precious?.rateLimit;
    if (rateLimit && result.provider) {
      setLiveRateLimit(userId, result.provider, rateLimit);
    }

    if (wantsStream && result.stream) {
      setRoutingHeaders(c, result.provider, result.model, result.failoverFrom, undefined, result.trail, conversationId);

      if (panelMode) {
        c.header('Content-Type', 'text/plain; charset=utf-8');
        c.header('Cache-Control', 'no-cache');
        c.header('Connection', 'keep-alive');

        return stream(c, async (s) => {
          const usageOut: { current: StreamUsage | null } = { current: null };
          let assistantText = '';
          for await (const text of sseToPlainText(result.stream!, usageOut)) {
            assistantText += text;
            await s.write(text);
          }
          if (!assistantText.trim()) {
            assistantText =
              'No response from the provider (empty stream). Often a rate limit on free models — try again or pick another model.';
            await s.write(assistantText);
          }

          // Record token usage from provider metadata or estimate from output
          let streamTokens = usageOut.current?.total_tokens ?? 0;
          if (streamTokens === 0) {
            const inputEstimate = estimateTokens(messages.map((m) => messageContentToText(m.content)).join(' '));
            const outputEstimate = estimateTokens(assistantText);
            streamTokens = inputEstimate + outputEstimate;
          }
          if (usedKey && streamTokens > 0) {
            recordKeyTokens(result.provider, usedKey.id, result.model, streamTokens);
            await persistKeyUsage(db, usedKey.id, result.provider, result.model);
          }

          await saveChatMessages(userId, conversationId!, [
            ...messages,
            { role: 'assistant', content: assistantText },
          ], buildMetaMap(messages.length, result));
        });
      }

      c.header('Content-Type', 'text/event-stream');
      c.header('Cache-Control', 'no-cache');
      c.header('Connection', 'keep-alive');

      const provider = result.provider;
      const model = result.model;
      const keyId = usedKeyId;
      const dbRef = db;

      return stream(c, async (s) => {
        const usageOut: { current: StreamUsage | null; outputText: string } = { current: null, outputText: '' };
        for await (const chunk of interceptSSEUsage(result.stream!, usageOut)) {
          await s.write(chunk);
        }

        let streamTokens = usageOut.current?.total_tokens ?? 0;
        if (streamTokens === 0) {
          const inputEstimate = estimateTokens(messages.map((m) => messageContentToText(m.content)).join(' '));
          const outputEstimate = estimateTokens(usageOut.outputText);
          streamTokens = inputEstimate + outputEstimate;
        }
        if (keyId && streamTokens > 0) {
          recordKeyTokens(provider, keyId, model, streamTokens);
          await persistKeyUsage(dbRef, keyId, provider, model);
        }
      });
    }

    const usage = result.response?.usage;
    setRoutingHeaders(c, result.provider, result.model, result.failoverFrom, usage, undefined, conversationId);

    if (panelMode && result.response) {
      const raw = result.response.choices[0]?.message?.content;
      const text = messageContentToText(raw);
      await saveChatMessages(userId, conversationId!, [
        ...messages,
        { role: 'assistant', content: text },
      ], buildMetaMap(messages.length, result));
      c.header('Content-Type', 'text/plain; charset=utf-8');
      return c.text(text);
    }

    return c.json(result.response);
  } catch (err) {
    if (usedKeyId) {
      await updateKeyHealth(db, usedKeyId, healthFromError(err));
    }
    const message = err instanceof Error ? err.message : 'Routing failed';
    await logAudit(db, userId, 'chat_request', {
      metadata: {
        error: message,
        model: requestBody.model,
        stream: wantsStream,
        usedKeyId: usedKeyId ?? null,
      },
    });
    return c.json({ error: { message, type: 'api_error' } }, 502);
  }
}

v1.post('/chat/completions', unifiedKeyAuth, (c) => handleChat(c, false, true));
v1.get('/models', unifiedKeyAuth, async (c) => {
  const userId = c.get('userId');
  const ctx = await loadUserContext(userId);
  return c.json({ object: 'list', data: listModels(ctx) });
});
v1.post('/embeddings', unifiedKeyAuth, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<EmbeddingRequest>();

  if (!body.input) {
    return c.json({ error: { message: 'input is required' } }, 400);
  }

  const limiter = apiRateLimiter;
  const limit = limiter.check(userId);
  if (!limit.allowed) {
    return c.json(
      { error: { message: 'Rate limit exceeded', type: 'rate_limit_error' } },
      429,
    );
  }

  const requestBody: EmbeddingRequest = {
    ...body,
    model: body.model || AUTO_MODEL,
    providerId: body.providerId,
  };

  const ctx = await loadUserContext(userId);
  const db = getDb();
  let usedKeyId: string | undefined;

  try {
    const result = await router.routeEmbedding(ctx, requestBody);

    const usedKey = ctx.providerKeys.find((k) => k.providerId === result.provider);
    if (usedKey) {
      usedKeyId = usedKey.id;
      recordKeyUsage(result.provider, usedKey.id, result.model);
      await persistKeyUsage(db, usedKey.id, result.provider, result.model);
    }

    setRoutingHeaders(c, result.provider, result.model, result.failoverFrom);
    return c.json(result.response);
  } catch (err) {
    if (usedKeyId) {
      await updateKeyHealth(db, usedKeyId, healthFromError(err));
    }
    const message = err instanceof Error ? err.message : 'Embedding routing failed';
    return c.json({ error: { message, type: 'api_error' } }, 502);
  }
});

export const chatSession = new Hono<{ Variables: AppVariables }>();
chatSession.post('/completions', localApiAuth, (c) => handleChat(c, true, false));
chatSession.get('/messages', localApiAuth, async (c) => {
  const userId = c.get('userId');
  const conversationId = c.req.query('conversationId');
  if (!conversationId) {
    return c.json({ error: 'conversationId required' }, 400);
  }
  const messages = await loadChatMessages(userId, conversationId!);
  const metaMap: Record<string, MessageMeta> = {};
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i] as { meta?: MessageMeta };
    if (m.meta) {
      metaMap[String(i)] = m.meta;
    }
  }
  return c.json({
    messages: messages.map(({ meta: _, ...rest }) => rest),
    metaMap,
  });
});
chatSession.delete('/messages', localApiAuth, async (c) => {
  const userId = c.get('userId');
  const conversationId = c.req.query('conversationId');
  if (!conversationId) {
    return c.json({ error: 'conversationId required' }, 400);
  }
  await clearChatMessages(userId, conversationId!);
  return c.json({ ok: true });
});
chatSession.get('/conversations', localApiAuth, async (c) => {
  const userId = c.get('userId');
  const entries = await getConversationEntries(userId);
  return c.json({ conversations: entries });
});
chatSession.post('/conversations', localApiAuth, async (c) => {
  const userId = c.get('userId');
  const { title } = await c.req.json<{ title?: string }>();
  const entry = await createConversation(userId, title);
  return c.json({ conversation: entry });
});
chatSession.delete('/conversations/:id', localApiAuth, async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'id required' }, 400);
  await deleteConversation(id);
  return c.json({ ok: true });
});
chatSession.patch('/conversations/:id', localApiAuth, async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'id required' }, 400);
  const { title } = await c.req.json<{ title?: string }>();
  if (title !== undefined) {
    await updateConversationMeta(id, { title });
  }
  return c.json({ ok: true });
});
chatSession.get('/models', localApiAuth, async (c) => {
  const userId = c.get('userId');
  const ctx = await loadUserContext(userId);
  return c.json({ object: 'list', data: listModels(ctx) });
});

export { v1 };
