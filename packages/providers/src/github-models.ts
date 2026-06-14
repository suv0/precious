import type { ProviderMeta } from '@precious/core';
import { createOpenAICompatAdapter, type ProviderConfig } from './base.js';

export const githubModelsConfig: ProviderConfig = {
  id: 'github-models',
  name: 'GitHub Models',
  riskLevel: 'medium',
  cloudSafe: true,
  defaultBaseUrl: 'https://models.github.ai/inference',
  defaultModels: ['openai/gpt-4.1', 'openai/gpt-4o', 'openai/gpt-4o-mini'],
};

export const githubModelsAdapter = createOpenAICompatAdapter(githubModelsConfig);

export const githubModelsMeta: ProviderMeta = {
  id: 'github-models',
  name: 'GitHub Models',
  riskLevel: 'medium',
  cloudSafe: true,
  freeTier: true,
  defaultBaseUrl: githubModelsConfig.defaultBaseUrl,
  keySetupUrl: 'https://github.com/settings/tokens',
  keySetupHint:
    'Create a classic PAT (Tokens → Generate new token → Generate new token (classic)). No extra scopes needed — the token just authenticates your GitHub account. Browse models at github.com/marketplace/models.',
};
