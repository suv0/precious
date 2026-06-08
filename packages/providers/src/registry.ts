import type { ProviderAdapter } from '@precious/core';
import type { ProviderMeta } from '@precious/core';
import { groqAdapter, groqMeta } from './groq.js';
import { geminiAdapter, geminiMeta } from './gemini.js';
import { openrouterAdapter, openrouterMeta } from './openrouter.js';
import { mistralAdapter, mistralMeta } from './mistral.js';
import { openaiAdapter, openaiMeta } from './openai.js';
import { openaiCompatAdapter, openaiCompatMeta } from './openai-compat.js';
import { cerebrasAdapter, cerebrasMeta } from './cerebras.js';
import { cloudflareAdapter, cloudflareMeta } from './cloudflare.js';
import { githubModelsAdapter, githubModelsMeta } from './github-models.js';
import { huggingfaceAdapter, huggingfaceMeta } from './huggingface.js';
import { cohereAdapter, cohereMeta } from './cohere.js';
import { ollamaCloudAdapter, ollamaCloudMeta } from './ollama-cloud.js';
import { zhipuAdapter, zhipuMeta } from './zhipu.js';
import { opencodeAdapter, opencodeMeta } from './opencode.js';
import { llm7Adapter, llm7Meta } from './llm7.js';
import { nvidiaAdapter, nvidiaMeta } from './nvidia.js';
import { pollinationsAdapter, pollinationsMeta } from './pollinations.js';
import { kiloAdapter, kiloMeta } from './kilo.js';

export const ALL_PROVIDERS: ProviderMeta[] = [
  groqMeta,
  geminiMeta,
  cerebrasMeta,
  cloudflareMeta,
  githubModelsMeta,
  openrouterMeta,
  mistralMeta,
  openaiMeta,
  huggingfaceMeta,
  ollamaCloudMeta,
  opencodeMeta,
  zhipuMeta,
  llm7Meta,
  cohereMeta,
  nvidiaMeta,
  pollinationsMeta,
  kiloMeta,
  openaiCompatMeta,
];

export const CLOUD_PROVIDERS: ProviderMeta[] = ALL_PROVIDERS.filter((p) => p.cloudSafe);

export const LOCAL_PROVIDERS: ProviderMeta[] = ALL_PROVIDERS;

export function getAllAdapters(): ProviderAdapter[] {
  return [
    groqAdapter,
    geminiAdapter,
    cerebrasAdapter,
    cloudflareAdapter,
    githubModelsAdapter,
    openrouterAdapter,
    mistralAdapter,
    openaiAdapter,
    huggingfaceAdapter,
    ollamaCloudAdapter,
    opencodeAdapter,
    zhipuAdapter,
    llm7Adapter,
    cohereAdapter,
    nvidiaAdapter,
    pollinationsAdapter,
    kiloAdapter,
    openaiCompatAdapter,
  ];
}

export function getCloudAdapters(): ProviderAdapter[] {
  const cloudIds = new Set(CLOUD_PROVIDERS.map((p) => p.id));
  return getAllAdapters().filter((a) => cloudIds.has(a.id));
}

export function getProviderMeta(id: string): ProviderMeta | undefined {
  return ALL_PROVIDERS.find((p) => p.id === id);
}

export { modelSupportsAttachments, getModelAttachmentCapabilities } from './attachments.js';

export function getDefaultModels(providerId: string): string[] {
  switch (providerId) {
    case 'groq':
      return ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
    case 'google-gemini':
      return ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
    case 'cerebras':
      return ['qwen-3-235b-a22b-instruct-2507', 'llama-3.3-70b'];
    case 'cloudflare':
      return ['@cf/moonshotai/kimi-k2-instruct', '@cf/z-ai/glm-4.7-flash'];
    case 'github-models':
      return ['openai/gpt-4.1', 'openai/gpt-4o'];
    case 'openrouter':
      return ['meta-llama/llama-3.3-70b-instruct:free'];
    case 'mistral':
      return ['mistral-small-latest'];
    case 'openai':
      return ['gpt-4o-mini', 'gpt-4o'];
    case 'huggingface':
      return ['deepseek-ai/DeepSeek-V3', 'moonshotai/Kimi-K2-Instruct'];
    case 'ollama-cloud':
      return ['glm-4.7', 'kimi-k2'];
    case 'opencode':
      return ['deepseek-v4-flash'];
    case 'zhipu':
      return ['glm-4-flash', 'glm-4.5-flash'];
    case 'llm7':
      return ['gpt-oss-20b', 'llama-3.1-turbo'];
    case 'cohere':
      return ['command-r-plus-08-2024'];
    case 'nvidia':
      return ['meta/llama-3.1-70b-instruct'];
    case 'pollinations':
      return ['openai-fast'];
    case 'kilo':
      return ['kilo/free'];
    case 'openai-compat':
      return ['llama3.2'];
    default:
      return [];
  }
}
