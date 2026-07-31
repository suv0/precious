import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  ProviderMeta,
} from '@precious/core';
import type { ProviderAdapter } from '@precious/core';
import { fetchWithTimeout, resolveProviderBaseUrl, providerHttpError, extractRateLimitHeaders } from './base.js';

export const geminiConfig = {
  id: 'google-gemini' as const,
  name: 'Google Gemini',
  riskLevel: 'medium' as const,
  cloudSafe: true,
  defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
  defaultModels: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'],
};

function geminiUrl(baseUrl: string | null | undefined): string {
  return `${resolveProviderBaseUrl(baseUrl, geminiConfig.defaultBaseUrl)}/chat/completions`;
}

function geminiEmbeddingUrl(baseUrl: string | null | undefined, model: string): string {
  const base = resolveProviderBaseUrl(baseUrl, geminiConfig.defaultBaseUrl);
  return `${base.replace('/openai', '')}/models/${model}:embedContent`;
}

export const geminiAdapter: ProviderAdapter = {
  id: 'google-gemini',

  async chatCompletion(apiKey, model, request, baseUrl) {
    const url = geminiUrl(baseUrl);
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildBody(model, request, false)),
    });
    if (!res.ok) {
      const text = await res.text();
      throw providerHttpError(res.status, text, 'Gemini');
    }
    const response = (await res.json()) as ChatCompletionResponse;
    response.precious = {
      provider: 'google-gemini',
      model,
      attempts: 1,
      ...(extractRateLimitHeaders(res.headers) ? { rateLimit: extractRateLimitHeaders(res.headers) } : {}),
    };
    return response;
  },

  async *streamChatCompletion(apiKey, model, request, baseUrl) {
    const url = geminiUrl(baseUrl);
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildBody(model, request, true)),
    });
    if (!res.ok) {
      const text = await res.text();
      throw providerHttpError(res.status, text, 'Gemini');
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
        if (data === '[DONE]') {
          yield 'data: [DONE]\n\n';
          return;
        }
        try {
          const chunk = JSON.parse(data);
          chunk.precious = { provider: 'google-gemini', model };
          yield `data: ${JSON.stringify(chunk)}\n\n`;
        } catch {
          // skip
        }
      }
    }
    yield 'data: [DONE]\n\n';
  },

  async embedding(apiKey, model, request, baseUrl) {
    const url = geminiEmbeddingUrl(baseUrl, model);
    const inputs = Array.isArray(request.input) ? request.input : [request.input];

    const allEmbeddings: Array<{ values: number[] }> = [];
    for (const text of inputs) {
      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          model: `models/${model}`,
          content: { parts: [{ text }] },
        }),
      });
      if (!res.ok) {
        throw providerHttpError(res.status, await res.text(), 'Gemini');
      }
      const data = await res.json() as { embedding?: { values: number[] } };
      if (!data.embedding?.values) {
        throw new Error('Gemini embedding returned no values');
      }
      allEmbeddings.push(data.embedding);
    }

    return {
      object: 'list',
      data: allEmbeddings.map((emb, idx) => ({
        object: 'embedding' as const,
        index: idx,
        embedding: emb.values,
      })),
      model,
      usage: { prompt_tokens: 0, total_tokens: 0 },
    };
  },
};

function buildBody(
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
    tools: request.tools,
    tool_choice: request.tool_choice,
  };
}

export const geminiMeta: ProviderMeta = {
  id: 'google-gemini',
  name: 'Google Gemini',
  riskLevel: 'medium',
  cloudSafe: true,
  freeTier: true,
  defaultBaseUrl: geminiConfig.defaultBaseUrl,
  keySetupUrl: 'https://aistudio.google.com/apikey',
  keySetupHint: 'Google AI Studio → Get API key → Create. Free tier available.',
};
