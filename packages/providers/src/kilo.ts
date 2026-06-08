import type { ProviderMeta } from '@precious/core';
import { createOpenAICompatAdapter, type ProviderConfig } from './base.js';

export const kiloConfig: ProviderConfig = {
  id: 'kilo',
  name: 'Kilo Gateway',
  riskLevel: 'medium',
  cloudSafe: false,
  defaultBaseUrl: 'https://api.kilo.ai/api/gateway/v1',
  defaultModels: ['kilo/free'],
  keyless: true,
};

export const kiloAdapter = createOpenAICompatAdapter(kiloConfig);

export const kiloMeta: ProviderMeta = {
  id: 'kilo',
  name: 'Kilo Gateway',
  riskLevel: 'medium',
  cloudSafe: false,
  defaultBaseUrl: kiloConfig.defaultBaseUrl,
  keySetupUrl: 'https://kilo.ai',
  keySetupLinkLabel: 'Kilo Gateway docs →',
  keySetupHint: 'Anonymous :free routes (~200 req/hr per IP). Prompts logged for training.',
  keyless: true,
};
