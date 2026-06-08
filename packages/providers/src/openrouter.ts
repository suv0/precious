import type { ProviderMeta } from '@precious/core';
import { createOpenAICompatAdapter, type ProviderConfig } from './base.js';

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
};

export const openrouterAdapter = createOpenAICompatAdapter(openrouterConfig);

export const openrouterMeta: ProviderMeta = {
  id: 'openrouter',
  name: 'OpenRouter',
  riskLevel: 'medium',
  cloudSafe: true,
  defaultBaseUrl: openrouterConfig.defaultBaseUrl,
  keySetupUrl: 'https://openrouter.ai/keys',
  keySetupHint: 'Sign up → Keys → Create. Many free models; keys start with sk-or-',
};
