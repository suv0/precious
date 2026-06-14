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
  freeTier: false,
  defaultBaseUrl: openaiConfig.defaultBaseUrl,
  keySetupUrl: 'https://platform.openai.com/api-keys',
  keySetupHint:
    '💳 Requires billing — no free API tier. Add $5+ at platform.openai.com/account/billing, then create a new key. For free OpenAI models, use OpenRouter or GitHub Models instead.',

};
