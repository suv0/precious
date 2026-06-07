import type { ProviderMeta } from '@precious/core';
import { createOpenAICompatAdapter, type ProviderConfig } from './base.js';

export const mistralConfig: ProviderConfig = {
  id: 'mistral',
  name: 'Mistral',
  riskLevel: 'low',
  cloudSafe: true,
  defaultBaseUrl: 'https://api.mistral.ai/v1',
  defaultModels: ['mistral-small-latest', 'open-mistral-nemo', 'codestral-latest'],
};

export const mistralAdapter = createOpenAICompatAdapter(mistralConfig);

export const mistralMeta: ProviderMeta = {
  id: 'mistral',
  name: 'Mistral',
  riskLevel: 'low',
  cloudSafe: true,
  defaultBaseUrl: mistralConfig.defaultBaseUrl,
};
