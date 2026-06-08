import type { ProviderMeta } from '@precious/core';
import { createOpenAICompatAdapter, type ProviderConfig } from './base.js';

export const openaiCompatConfig: ProviderConfig = {
  id: 'openai-compat',
  name: 'Custom OpenAI-compatible',
  riskLevel: 'medium',
  cloudSafe: false,
  defaultBaseUrl: 'http://localhost:11434/v1',
  defaultModels: ['llama3.2', 'llama3.1', 'mistral'],
};

export const openaiCompatAdapter = createOpenAICompatAdapter(openaiCompatConfig);

export const openaiCompatMeta: ProviderMeta = {
  id: 'openai-compat',
  name: 'Custom OpenAI-compatible',
  riskLevel: 'medium',
  cloudSafe: false,
  keySetupUrl: 'https://docs.ollama.com/api/openai-compatibility',
  keySetupLinkLabel: 'Ollama OpenAI API docs →',
  keySetupHint:
    'Runs on your machine (Ollama, LM Studio, etc.). No cloud signup — install the server, pull a model, then paste the base URL below.',
};
