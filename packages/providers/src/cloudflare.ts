import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatMessage,
  MessageContentPart,
  ProviderMeta,
} from '@precious/core';
import type { ProviderAdapter } from '@precious/core';
import { fetchWithTimeout, providerHttpError, streamOpenAIResponse, extractRateLimitHeaders } from './base.js';

export const cloudflareConfig = {
  id: 'cloudflare' as const,
  name: 'Cloudflare Workers AI',
  riskLevel: 'medium' as const,
  cloudSafe: true,
  defaultModels: [
    '@cf/moonshotai/kimi-k2.6',
    '@cf/zai-org/glm-4.7-flash',
    '@cf/google/gemma-4-26b-a4b-it',
    '@cf/meta/llama-3.1-8b-instruct',
    '@cf/openai/gpt-oss-120b',
  ],
};

function contentToString(content: string | MessageContentPart[] | null | undefined): string {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  return content
    .filter((p) => p.type === 'text')
    .map((p) => p.text)
    .join('\n');
}

function normalizeMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((m) => ({ ...m, content: contentToString(m.content) }));
}

function parseKey(apiKey: string): { accountId: string; token: string } {
  const sep = apiKey.indexOf(':');
  if (sep === -1) {
    throw new Error('Cloudflare key must be in format "account_id:api_token"');
  }
  return { accountId: apiKey.slice(0, sep), token: apiKey.slice(sep + 1) };
}

function chatUrl(accountId: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;
}

function buildBody(
  model: string,
  request: ChatCompletionRequest,
  stream: boolean,
): Record<string, unknown> {
  return {
    model,
    messages: normalizeMessages(request.messages),
    stream,
    temperature: request.temperature,
    max_tokens: request.max_tokens,
    top_p: request.top_p,
  };
}

export const cloudflareAdapter: ProviderAdapter = {
  id: 'cloudflare',

  async chatCompletion(apiKey, model, request, _baseUrl) {
    const { accountId, token } = parseKey(apiKey);
    const res = await fetchWithTimeout(chatUrl(accountId), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildBody(model, request, false)),
    });
    if (!res.ok) {
      const text = await res.text();
      throw providerHttpError(res.status, text, 'Cloudflare');
    }
    const response = (await res.json()) as ChatCompletionResponse;
    response.precious = {
      provider: 'cloudflare',
      model,
      attempts: 1,
      ...(extractRateLimitHeaders(res.headers) ? { rateLimit: extractRateLimitHeaders(res.headers) } : {}),
    };
    return response;
  },

  async *streamChatCompletion(apiKey, model, request, _baseUrl) {
    const { accountId, token } = parseKey(apiKey);
    const res = await fetchWithTimeout(chatUrl(accountId), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildBody(model, request, true)),
    });
    yield* streamOpenAIResponse(res, 'cloudflare', model);
    yield 'data: [DONE]\n\n';
  },
};

export const cloudflareMeta: ProviderMeta = {
  id: 'cloudflare',
  name: 'Cloudflare Workers AI',
  riskLevel: 'medium',
  cloudSafe: true,
  freeTier: true,
  keySetupUrl: 'https://dash.cloudflare.com/?to=/:account/ai/workers-ai',
  keySetupHint:
    'Paste key as account_id:api_token. Create token at Profile → API Tokens with Workers AI Read.',
};
