import type { ProviderMeta } from '@precious/core';
import { createOpenAICompatAdapter, type ProviderConfig } from './base.js';

export const nvidiaConfig: ProviderConfig = {
  id: 'nvidia',
  name: 'NVIDIA NIM',
  riskLevel: 'high',
  cloudSafe: false,
  defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
  defaultModels: ['meta/llama-3.1-70b-instruct', 'meta/llama-3.1-8b-instruct'],
};

export const nvidiaAdapter = createOpenAICompatAdapter(nvidiaConfig);

export const nvidiaMeta: ProviderMeta = {
  id: 'nvidia',
  name: 'NVIDIA NIM',
  riskLevel: 'high',
  cloudSafe: false,
  freeTier: true,
  defaultBaseUrl: nvidiaConfig.defaultBaseUrl,
  keySetupUrl: 'https://build.nvidia.com/',
  keySetupHint: 'Evaluation-only ToS. Generate API key at build.nvidia.com. Local-only in Precious.',
};
