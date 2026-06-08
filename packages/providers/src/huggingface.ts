import type { ProviderMeta } from '@precious/core';
import { createOpenAICompatAdapter, type ProviderConfig } from './base.js';

export const huggingfaceConfig: ProviderConfig = {
  id: 'huggingface',
  name: 'HuggingFace Router',
  riskLevel: 'medium',
  cloudSafe: true,
  defaultBaseUrl: 'https://router.huggingface.co/v1',
  defaultModels: [
    'deepseek-ai/DeepSeek-V3',
    'Qwen/Qwen3-235B-A22B-Instruct-2507',
    'moonshotai/Kimi-K2-Instruct',
  ],
};

export const huggingfaceAdapter = createOpenAICompatAdapter(huggingfaceConfig);

export const huggingfaceMeta: ProviderMeta = {
  id: 'huggingface',
  name: 'HuggingFace Router',
  riskLevel: 'medium',
  cloudSafe: true,
  defaultBaseUrl: huggingfaceConfig.defaultBaseUrl,
  keySetupUrl: 'https://huggingface.co/settings/tokens',
  keySetupHint: 'Create a read token → Inference Providers router. ~$0.10/mo free credit.',
};
