import type { ProviderMeta } from '@precious/core';
import { createOpenAICompatAdapter, type ProviderConfig } from './base.js';

export const openaiCompatConfig: ProviderConfig = {
  id: 'openai-compat',
  name: 'Custom OpenAI-compatible',
  riskLevel: 'medium',
  cloudSafe: false,
  defaultBaseUrl: 'http://localhost:11434/v1',
  defaultModels: ['llama3', 'mistral', 'gpt-4o-mini'],
};

export const openaiCompatAdapter = createOpenAICompatAdapter(openaiCompatConfig);

export const openaiCompatMeta: ProviderMeta = {
  id: 'openai-compat',
  name: 'Custom OpenAI-compatible',
  riskLevel: 'medium',
  cloudSafe: false,
};
