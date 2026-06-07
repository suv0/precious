import type { ProviderAdapter } from '@precious/core';
import type { ProviderMeta } from '@precious/core';
import { groqAdapter, groqMeta } from './groq.js';
import { geminiAdapter, geminiMeta } from './gemini.js';
import { openrouterAdapter, openrouterMeta } from './openrouter.js';
import { mistralAdapter, mistralMeta } from './mistral.js';
import { openaiCompatAdapter, openaiCompatMeta } from './openai-compat.js';

export const ALL_PROVIDERS: ProviderMeta[] = [
  groqMeta,
  geminiMeta,
  openrouterMeta,
  mistralMeta,
  openaiCompatMeta,
];

export const CLOUD_PROVIDERS: ProviderMeta[] = ALL_PROVIDERS.filter((p) => p.cloudSafe);

export const LOCAL_PROVIDERS: ProviderMeta[] = ALL_PROVIDERS;

export function getAllAdapters(): ProviderAdapter[] {
  return [
    groqAdapter,
    geminiAdapter,
    openrouterAdapter,
    mistralAdapter,
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

export function getDefaultModels(providerId: string): string[] {
  switch (providerId) {
    case 'groq':
      return ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
    case 'google-gemini':
      return ['gemini-2.0-flash', 'gemini-1.5-flash'];
    case 'openrouter':
      return ['meta-llama/llama-3.3-70b-instruct:free'];
    case 'mistral':
      return ['mistral-small-latest'];
    case 'openai-compat':
      return ['llama3'];
    default:
      return [];
  }
}
