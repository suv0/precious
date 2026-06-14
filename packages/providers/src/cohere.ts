import type { ProviderMeta } from '@precious/core';
import { createOpenAICompatAdapter, type ProviderConfig } from './base.js';

export const cohereConfig: ProviderConfig = {
  id: 'cohere',
  name: 'Cohere',
  riskLevel: 'high',
  cloudSafe: false,
  defaultBaseUrl: 'https://api.cohere.ai/compatibility/v1',
  defaultModels: ['command-r-plus-08-2024', 'command-a-03-2025'],
};

export const cohereAdapter = createOpenAICompatAdapter(cohereConfig);

export const cohereMeta: ProviderMeta = {
  id: 'cohere',
  name: 'Cohere',
  riskLevel: 'high',
  cloudSafe: false,
  freeTier: true,
  defaultBaseUrl: cohereConfig.defaultBaseUrl,
  keySetupUrl: 'https://dashboard.cohere.com/api-keys',
  keySetupHint:
    'Trial tier available. ToS restricts personal/household use — local-only in Precious.',
};
