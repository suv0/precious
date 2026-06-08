import type { ProviderMeta } from '@precious/core';
import { createOpenAICompatAdapter, type ProviderConfig } from './base.js';

export const ollamaCloudConfig: ProviderConfig = {
  id: 'ollama-cloud',
  name: 'Ollama Cloud',
  riskLevel: 'medium',
  cloudSafe: true,
  defaultBaseUrl: 'https://ollama.com/v1',
  defaultModels: ['glm-4.7', 'kimi-k2', 'gpt-oss:20b', 'qwen3-coder:30b'],
  timeoutMs: 120_000,
};

export const ollamaCloudAdapter = createOpenAICompatAdapter(ollamaCloudConfig);

export const ollamaCloudMeta: ProviderMeta = {
  id: 'ollama-cloud',
  name: 'Ollama Cloud',
  riskLevel: 'medium',
  cloudSafe: true,
  defaultBaseUrl: ollamaCloudConfig.defaultBaseUrl,
  keySetupUrl: 'https://ollama.com/signin',
  keySetupHint: 'Free plan: 1 concurrent model, GPU-time quota. Sign in → API key in settings.',
};
