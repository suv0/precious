import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionChunk,
  ProviderId,
} from '@precious/core';
import type { ProviderAdapter } from '@precious/core';

export type { ProviderAdapter };

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  riskLevel: 'low' | 'medium' | 'high';
  cloudSafe: boolean;
  defaultBaseUrl: string;
  defaultModels: string[];
}

const REQUEST_TIMEOUT_MS = 120_000;

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function buildOpenAIRequestBody(
  model: string,
  request: ChatCompletionRequest,
  stream: boolean,
): Record<string, unknown> {
  return {
    model,
    messages: request.messages,
    stream,
    temperature: request.temperature,
    max_tokens: request.max_tokens,
    top_p: request.top_p,
    stop: request.stop,
  };
}

export async function parseOpenAIResponse(res: Response): Promise<ChatCompletionResponse> {
  if (!res.ok) {
    const text = await res.text();
    throw providerHttpError(res.status, text);
  }
  return (await res.json()) as ChatCompletionResponse;
}

export function providerHttpError(status: number, body: string, providerName?: string): Error {
  const prefix = providerName ? `${providerName} error ${status}` : `Provider error ${status}`;
  if (status === 429) {
    return new Error(`${prefix}: rate limit or quota exceeded.`);
  }
  const short = extractErrorMessage(body);
  return new Error(`${prefix}: ${short}`);
}

function extractErrorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string }; message?: string };
    const msg = parsed.error?.message ?? parsed.message;
    if (msg) return msg.length > 200 ? `${msg.slice(0, 197)}…` : msg;
  } catch {
    /* plain text */
  }
  return body.length > 200 ? `${body.slice(0, 197)}…` : body;
}

export async function* streamOpenAIResponse(
  res: Response,
  provider: ProviderId,
  model: string,
): AsyncGenerator<string, void, unknown> {
  if (!res.ok) {
    const text = await res.text();
    throw providerHttpError(res.status, text, 'Provider');
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') return;

      try {
        const chunk = JSON.parse(data) as ChatCompletionChunk;
        chunk.precious = { provider, model };
        yield `data: ${JSON.stringify(chunk)}\n\n`;
      } catch {
        // skip malformed chunks
      }
    }
  }
}

export function resolveProviderBaseUrl(
  baseUrl: string | null | undefined,
  defaultBaseUrl: string,
): string {
  const trimmed = baseUrl?.trim();
  return (trimmed || defaultBaseUrl).replace(/\/$/, '');
}

export function createOpenAICompatAdapter(
  config: ProviderConfig,
): ProviderAdapter {
  return {
    id: config.id,

    async chatCompletion(apiKey, model, request, baseUrl) {
      const url = `${resolveProviderBaseUrl(baseUrl, config.defaultBaseUrl)}/chat/completions`;
      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildOpenAIRequestBody(model, request, false)),
      });
      const response = await parseOpenAIResponse(res);
      response.precious = { provider: config.id, model, attempts: 1 };
      return response;
    },

    async *streamChatCompletion(apiKey, model, request, baseUrl) {
      const url = `${resolveProviderBaseUrl(baseUrl, config.defaultBaseUrl)}/chat/completions`;
      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildOpenAIRequestBody(model, request, true)),
      });
      yield* streamOpenAIResponse(res, config.id, model);
      yield 'data: [DONE]\n\n';
    },
  };
}
