import type { ProviderId } from '@precious/core';

/** Which models accept image inputs (screenshots, photos). */
type CapabilityRule =
  | 'all'
  | {
      include?: string[];
      patterns?: string[];
    };

const IMAGE_RULES: Record<ProviderId, CapabilityRule> = {
  'google-gemini': 'all',
  groq: {
    patterns: ['vision', 'llava', 'gemma2'],
    include: ['llama-3.2-90b-vision-preview', 'llama-3.2-11b-vision-preview'],
  },
  cerebras: { patterns: ['vision'] },
  cloudflare: { patterns: ['vision', 'vl-', 'pixtral'] },
  'github-models': { patterns: ['gpt-4o', 'gpt-4.1', 'gpt-4-turbo', 'vision'] },
  openrouter: {
    patterns: [
      'vision',
      'vl-',
      'gemini',
      'gpt-4o',
      'gpt-4-turbo',
      'claude-3',
      'claude-4',
      'pixtral',
      'llava',
      'qwen-vl',
      'internvl',
    ],
  },
  mistral: {
    patterns: ['pixtral', 'vision'],
    include: ['pixtral-large-latest', 'pixtral-12b-2409'],
  },
  openai: {
    patterns: ['gpt-4o', 'gpt-4.1', 'gpt-4-turbo', 'gpt-5', 'o1', 'o3', 'o4', 'vision'],
  },
  huggingface: { patterns: ['vision', 'vl-', 'gemini', 'llava', 'qwen-vl'] },
  'ollama-cloud': { patterns: ['vision', 'vl-', '4.6v'] },
  zhipu: { patterns: ['vision', 'vl-', '4.6v', '4.5v'] },
  opencode: { patterns: ['vision', 'vl-'] },
  llm7: { patterns: ['vision', '4.6v'] },
  cohere: { patterns: ['vision'] },
  nvidia: { patterns: ['vision', 'vl-'] },
  pollinations: { patterns: ['vision'] },
  kilo: { patterns: ['vision', 'vl-'] },
  'openai-compat': 'all',
};

/** Models that can work with uploaded files (CSV, PDF, etc.), not just pixels. */
const DOCUMENT_RULES: Record<ProviderId, CapabilityRule> = {
  'google-gemini': 'all',
  openai: { patterns: ['gpt-4o', 'gpt-4.1', 'gpt-4-turbo', 'gpt-5', 'o1', 'o3', 'o4'] },
  openrouter: {
    patterns: ['gemini', 'claude-3', 'claude-4', 'gpt-4o', 'gpt-4.1', 'gpt-5', 'gpt-4-turbo'],
  },
  'github-models': { patterns: ['gpt-4o', 'gpt-4.1', 'gpt-4-turbo'] },
  'openai-compat': 'all',
  groq: { patterns: ['vision'], include: ['llama-3.2-90b-vision-preview'] },
  mistral: { include: ['pixtral-large-latest'] },
  cerebras: { patterns: [] },
  cloudflare: { patterns: [] },
  huggingface: { patterns: ['gemini', 'claude', 'gpt-4o'] },
  'ollama-cloud': { patterns: [] },
  zhipu: { patterns: ['4.6v', '4.5v'] },
  opencode: { patterns: [] },
  llm7: { patterns: [] },
  cohere: { patterns: [] },
  nvidia: { patterns: [] },
  pollinations: { patterns: [] },
  kilo: { patterns: [] },
};

export interface ModelAttachmentCapabilities {
  images: boolean;
  documents: boolean;
}

function matchesRule(rule: CapabilityRule | undefined, model: string): boolean {
  if (!rule) return false;
  if (rule === 'all') return true;
  const id = model.toLowerCase();
  if (rule.include?.some((m) => m.toLowerCase() === id)) return true;
  if (rule.patterns?.some((p) => p.length > 0 && id.includes(p.toLowerCase()))) return true;
  return false;
}

export function getModelAttachmentCapabilities(
  providerId: string,
  model: string,
): ModelAttachmentCapabilities {
  const pid = providerId as ProviderId;
  return {
    images: matchesRule(IMAGE_RULES[pid], model),
    documents: matchesRule(DOCUMENT_RULES[pid], model),
  };
}

/** True when the model can accept images and/or file uploads in chat. */
export function modelSupportsAttachments(providerId: string, model: string): boolean {
  const caps = getModelAttachmentCapabilities(providerId, model);
  return caps.images || caps.documents;
}

/** @deprecated use getModelAttachmentCapabilities — kept for importers of vision.ts */
export function modelSupportsImages(providerId: string, model: string): boolean {
  return getModelAttachmentCapabilities(providerId, model).images;
}
