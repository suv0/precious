import type { ProviderMeta } from '@precious/core';
import { createOpenAICompatAdapter, type ProviderConfig } from './base.js';

export const pollinationsConfig: ProviderConfig = {
  id: 'pollinations',
  name: 'Pollinations',
  riskLevel: 'medium',
  cloudSafe: false,
  defaultBaseUrl: 'https://text.pollinations.ai/openai/v1',
  defaultModels: ['openai-fast'],
  keyless: true,
};

export const pollinationsAdapter = createOpenAICompatAdapter(pollinationsConfig);

export const pollinationsMeta: ProviderMeta = {
  id: 'pollinations',
  name: 'Pollinations',
  riskLevel: 'medium',
  cloudSafe: false,
  freeTier: true,
  defaultBaseUrl: pollinationsConfig.defaultBaseUrl,
  keySetupUrl: 'https://pollinations.ai',
  keySetupLinkLabel: 'Pollinations docs →',
  keySetupHint: 'Anonymous tier — no API key needed. GPT-OSS 20B, rate-limited.',
  keyless: true,
};
