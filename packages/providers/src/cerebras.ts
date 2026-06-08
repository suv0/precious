import type { ProviderMeta } from '@precious/core';
import { createOpenAICompatAdapter, type ProviderConfig } from './base.js';

export const cerebrasConfig: ProviderConfig = {
  id: 'cerebras',
  name: 'Cerebras',
  riskLevel: 'low',
  cloudSafe: true,
  defaultBaseUrl: 'https://api.cerebras.ai/v1',
  defaultModels: ['qwen-3-235b-a22b-instruct-2507', 'llama-3.3-70b'],
};

export const cerebrasAdapter = createOpenAICompatAdapter(cerebrasConfig);

export const cerebrasMeta: ProviderMeta = {
  id: 'cerebras',
  name: 'Cerebras',
  riskLevel: 'low',
  cloudSafe: true,
  defaultBaseUrl: cerebrasConfig.defaultBaseUrl,
  keySetupUrl: 'https://cloud.cerebras.ai/platform',
  keySetupHint: 'Sign up free → API Keys → Create. Very fast inference on Qwen3 235B.',
};
