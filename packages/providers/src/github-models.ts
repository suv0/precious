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
  defaultBaseUrl: githubModelsConfig.defaultBaseUrl,
  keySetupUrl: 'https://github.com/settings/personal-access-tokens',
  keySetupHint:
    'Create a fine-grained PAT with Models access, or use GitHub CLI auth. Experimentation tier only.',
};
