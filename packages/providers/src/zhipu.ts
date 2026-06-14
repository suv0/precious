import type { ProviderMeta } from '@precious/core';
import { createOpenAICompatAdapter, type ProviderConfig } from './base.js';

export const zhipuConfig: ProviderConfig = {
  id: 'zhipu',
  name: 'Z.ai (Zhipu)',
  riskLevel: 'medium',
  cloudSafe: false,
  defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
  defaultModels: ['glm-4-flash', 'glm-4.5-flash', 'glm-4.6v-flash'],
};

export const zhipuAdapter = createOpenAICompatAdapter(zhipuConfig);

export const zhipuMeta: ProviderMeta = {
  id: 'zhipu',
  name: 'Z.ai (Zhipu)',
  riskLevel: 'medium',
  cloudSafe: false,
  freeTier: true,
  defaultBaseUrl: zhipuConfig.defaultBaseUrl,
  keySetupUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
  keySetupHint: 'Register at open.bigmodel.cn → API Keys. GLM-4.5 / GLM-4.7 Flash free tier.',
};
