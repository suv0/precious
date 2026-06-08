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
  type ChatCompletionRequest,
  type ProviderId,
  type MessageContentPart,
} from '@precious/core';
import { getAllAdapters, LOCAL_PROVIDERS, getDefaultModels, modelSupportsAttachments } from '@precious/providers';
import { getDb } from '../db/index.js';
import { providerKeys, fallbackChain } from '../db/schema.js';
import { logAudit } from '../lib/utils.js';
import {
  loadChatMessages,
  mergeChatMessages,
  saveChatMessages,
  clearChatMessages,
} from '../lib/chat-messages.js';
import {
  hydrateKeyRateLedger,
  buildKeyAvailabilityChecker,
  loadKeyHealthMap,
  recordKeyUsage,
  persistKeyUsage,
} from '../lib/key-usage.js';
import { updateKeyHealth } from '../services/health.js';
import { localApiAuth, unifiedKeyAuth, type AppVariables } from '../middleware/auth.js';
import { ensureFallbackChainForKeys } from '../lib/fallback-chain.js';

const router = new Router(getAllAdapters());
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
    .map((e) => ({
      id: e.model,
      object: 'model' as const,
      owned_by: e.providerId,
      supports_attachments: modelSupportsAttachments(e.providerId, e.model),
      precious: LOCAL_PROVIDERS.find((p) => p.id === e.providerId),
    }));

  if (chainModels.length === 0) {
    return [
      {
        id: AUTO_MODEL,
        object: 'model' as const,
        owned_by: 'precious',
        supports_attachments: false,
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
}

/** OpenAI SSE chunks → plain text for panel useChat (streamProtocol: text). */
async function* sseToPlainText(
  stream: AsyncGenerator<string, void, unknown>,
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
        };
        if (parsed.error) {
          const err = parsed.error;
          const msg =
            typeof err === 'string'
              ? err
              : err.message ?? `Provider error ${err.code ?? ''}`.trim();
          throw new Error(msg || 'Provider returned a streaming error');
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
    model: body.model || AUTO_MODEL,
    providerId: body.providerId,
  };

  if (!panelMode) {
    await saveChatMessages(userId, messages);
  }

  const ctx = await loadUserContext(userId);
  const db = getDb();

  await logAudit(db, userId, 'chat_request', {
    metadata: { model: requestBody.model, stream: body.stream ?? false },
  });

  const wantsStream = body.stream === true;
  let usedKeyId: string | undefined;

  try {
    const result = await router.route(ctx, requestBody, wantsStream);

    const usedKey = ctx.providerKeys.find((k) => k.providerId === result.provider);
    if (usedKey) {
      usedKeyId = usedKey.id;
      recordKeyUsage(result.provider, usedKey.id);
      await persistKeyUsage(db, usedKey.id, result.provider);
    }

    if (wantsStream && result.stream) {
      setRoutingHeaders(c, result.provider, result.model, result.failoverFrom);

      if (panelMode) {
        c.header('Content-Type', 'text/plain; charset=utf-8');
        c.header('Cache-Control', 'no-cache');
        c.header('Connection', 'keep-alive');

        return stream(c, async (s) => {
          let assistantText = '';
          for await (const text of sseToPlainText(result.stream!)) {
            assistantText += text;
            await s.write(text);
          }
          if (!assistantText.trim()) {
            assistantText =
              'No response from the provider (empty stream). Often a rate limit on free models — try again or pick another model.';
            await s.write(assistantText);
          }
          await saveChatMessages(userId, [
            ...messages,
            { role: 'assistant', content: assistantText },
          ]);
        });
      }

      c.header('Content-Type', 'text/event-stream');
      c.header('Cache-Control', 'no-cache');
      c.header('Connection', 'keep-alive');

      return stream(c, async (s) => {
        for await (const chunk of result.stream!) {
          await s.write(chunk);
        }
      });
    }

    const usage = result.response?.usage;
    setRoutingHeaders(c, result.provider, result.model, result.failoverFrom, usage);

    if (panelMode && result.response) {
      const raw = result.response.choices[0]?.message?.content;
      const text = messageContentToText(raw);
      await saveChatMessages(userId, [
        ...messages,
        { role: 'assistant', content: text },
      ]);
      c.header('Content-Type', 'text/plain; charset=utf-8');
      return c.text(text);
    }

    return c.json(result.response);
  } catch (err) {
    if (usedKeyId) {
      await updateKeyHealth(db, usedKeyId, healthFromError(err));
    }
    const message = err instanceof Error ? err.message : 'Routing failed';
    return c.json({ error: { message, type: 'api_error' } }, 502);
  }
}

v1.post('/chat/completions', unifiedKeyAuth, (c) => handleChat(c, false, true));
v1.get('/models', unifiedKeyAuth, async (c) => {
  const userId = c.get('userId');
  const ctx = await loadUserContext(userId);
  return c.json({ object: 'list', data: listModels(ctx) });
});

export const chatSession = new Hono<{ Variables: AppVariables }>();
chatSession.post('/completions', localApiAuth, (c) => handleChat(c, true, false));
chatSession.get('/messages', localApiAuth, async (c) => {
  const userId = c.get('userId');
  const messages = await loadChatMessages(userId);
  return c.json({ messages });
});
chatSession.delete('/messages', localApiAuth, async (c) => {
  const userId = c.get('userId');
  await clearChatMessages(userId);
  return c.json({ ok: true });
});
chatSession.get('/models', localApiAuth, async (c) => {
  const userId = c.get('userId');
  const ctx = await loadUserContext(userId);
  return c.json({ object: 'list', data: listModels(ctx) });
});

export { v1 };
