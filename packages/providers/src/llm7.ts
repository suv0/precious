import type { ProviderMeta } from '@precious/core';
import { createOpenAICompatAdapter, type ProviderConfig } from './base.js';

export const llm7Config: ProviderConfig = {
  id: 'llm7',
  name: 'LLM7',
  riskLevel: 'medium',
  cloudSafe: false,
  defaultBaseUrl: 'https://api.llm7.io/v1',
  defaultModels: ['gpt-oss-20b', 'llama-3.1-turbo', 'glm-4.6v-flash'],
};

export const llm7Adapter = createOpenAICompatAdapter(llm7Config);

export const llm7Meta: ProviderMeta = {
  id: 'llm7',
  name: 'LLM7',
  riskLevel: 'medium',
  cloudSafe: false,
  freeTier: true,
  defaultBaseUrl: llm7Config.defaultBaseUrl,
  keySetupUrl: 'https://llm7.io',
  keySetupHint: 'Free tier ~100 req/hr. Anonymous access works for basic models; optional API token.',
};
