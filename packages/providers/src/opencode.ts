import type { ProviderMeta } from '@precious/core';
import { createOpenAICompatAdapter, type ProviderConfig } from './base.js';

export const opencodeConfig: ProviderConfig = {
  id: 'opencode',
  name: 'OpenCode Zen',
  riskLevel: 'medium',
  cloudSafe: true,
  defaultBaseUrl: 'https://opencode.ai/zen/v1',
  defaultModels: ['deepseek-v4-flash', 'nemotron-nano-9b-v2'],
};

export const opencodeAdapter = createOpenAICompatAdapter(opencodeConfig);

export const opencodeMeta: ProviderMeta = {
  id: 'opencode',
  name: 'OpenCode Zen',
  riskLevel: 'medium',
  cloudSafe: true,
  defaultBaseUrl: opencodeConfig.defaultBaseUrl,
  keySetupUrl: 'https://opencode.ai/auth',
  keySetupHint: 'Free account (no card) → promotional models. Prompts may be used for training.',
};
