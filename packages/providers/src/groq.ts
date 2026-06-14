import type { ProviderMeta } from '@precious/core';
import { createOpenAICompatAdapter, type ProviderConfig } from './base.js';

export const groqConfig: ProviderConfig = {
  id: 'groq',
  name: 'Groq',
  riskLevel: 'low',
  cloudSafe: true,
  defaultBaseUrl: 'https://api.groq.com/openai/v1',
  defaultModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
};

export const groqAdapter = createOpenAICompatAdapter(groqConfig);

export const groqMeta: ProviderMeta = {
  id: 'groq',
  name: 'Groq',
  riskLevel: 'low',
  cloudSafe: true,
  freeTier: true,
  defaultBaseUrl: groqConfig.defaultBaseUrl,
  keySetupUrl: 'https://console.groq.com/keys',
  keySetupHint: 'Sign up free → API Keys → Create. Keys start with gsk_',
};
