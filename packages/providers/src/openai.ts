import type { ProviderMeta } from '@precious/core';
import { createOpenAICompatAdapter, type ProviderConfig } from './base.js';

export const openaiConfig: ProviderConfig = {
  id: 'openai',
  name: 'OpenAI',
  riskLevel: 'medium',
  cloudSafe: true,
  defaultBaseUrl: 'https://api.openai.com/v1',
  defaultModels: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'],
};

export const openaiAdapter = createOpenAICompatAdapter(openaiConfig);

export const openaiMeta: ProviderMeta = {
  id: 'openai',
  name: 'OpenAI',
  riskLevel: 'medium',
  cloudSafe: true,
  defaultBaseUrl: openaiConfig.defaultBaseUrl,
  keySetupUrl: 'https://platform.openai.com/api-keys',
  keySetupHint: 'Sign in → API keys → Create new secret key. Keys start with sk-',
};
