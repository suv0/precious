import type { ProviderMeta } from '@precious/core';
import { createOpenAICompatAdapter, fetchWithTimeout, providerHttpError, type ProviderConfig } from './base.js';

export const openrouterConfig: ProviderConfig = {
  id: 'openrouter',
  name: 'OpenRouter',
  riskLevel: 'medium',
  cloudSafe: true,
  defaultBaseUrl: 'https://openrouter.ai/api/v1',
  defaultModels: [
    'meta-llama/llama-3.3-70b-instruct:free',
    'google/gemini-2.0-flash-exp:free',
    'mistralai/mistral-7b-instruct:free',
  ],
  extraHeaders: {
    'HTTP-Referer': 'https://precious.local',
    'X-Title': 'Precious',
  },
};

export const openrouterAdapter = createOpenAICompatAdapter(openrouterConfig);

export const openrouterMeta: ProviderMeta = {
  id: 'openrouter',
  name: 'OpenRouter',
  riskLevel: 'medium',
  cloudSafe: true,
  defaultBaseUrl: openrouterConfig.defaultBaseUrl,
  keySetupUrl: 'https://openrouter.ai/keys',
  keySetupHint:
    'Sign up → Keys → Create (sk-or-…). Free models share global capacity — 429 during peak is common even with zero personal use.',
};

/** Validate key via OpenRouter metadata API — avoids burning free-model quota on health probes. */
export async function verifyOpenRouterKey(apiKey: string): Promise<string> {
  const res = await fetchWithTimeout(
    `${openrouterConfig.defaultBaseUrl}/key`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...openrouterConfig.extraHeaders,
      },
    },
    15_000,
  );

  if (!res.ok) {
    const text = await res.text();
    throw providerHttpError(res.status, text, 'OpenRouter');
  }

  const body = (await res.json()) as {
    data?: { is_free_tier?: boolean; usage_daily?: number; label?: string };
  };
  const data = body.data;
  if (!data) return 'Key is valid.';

  const tier = data.is_free_tier ? 'free tier' : 'paid credits';
  const daily = typeof data.usage_daily === 'number' ? data.usage_daily : null;
  if (daily != null && daily === 0) {
    return `Key is valid (${tier}, 0 credits used today).`;
  }
  if (daily != null) {
    return `Key is valid (${tier}, ${daily} credits used today).`;
  }
  return `Key is valid (${tier}).`;
}
