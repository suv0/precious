import type { ProviderId } from '@precious/core';

/**
 * Which models accept image/file attachments (OpenAI multimodal format).
 * Uses explicit lists + name patterns so new vision models work without UI changes.
 */
type VisionRule =
  | 'all'
  | {
      /** Exact model ids */
      include?: string[];
      /** Case-insensitive substring matches on model id */
      patterns?: string[];
    };

const VISION_RULES: Record<ProviderId, VisionRule> = {
  'google-gemini': 'all',
  groq: {
    patterns: ['vision', 'llava', 'gemma2'],
    include: ['llama-3.2-90b-vision-preview', 'llama-3.2-11b-vision-preview'],
  },
  cerebras: { patterns: ['vision'] },
  cloudflare: { patterns: ['vision', 'vl-', 'pixtral'] },
  'github-models': {
    patterns: ['gpt-4o', 'gpt-4.1', 'gpt-4-turbo', 'vision'],
  },
  openrouter: {
    patterns: [
      'vision',
      'vl-',
      'gemini',
      'gpt-4o',
      'gpt-4-turbo',
      'claude-3',
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

export function modelSupportsAttachments(providerId: string, model: string): boolean {
  const rule = VISION_RULES[providerId as ProviderId];
  if (!rule) return false;
  if (rule === 'all') return true;

  const id = model.toLowerCase();
  if (rule.include?.some((m) => m.toLowerCase() === id)) return true;
  if (rule.patterns?.some((p) => id.includes(p.toLowerCase()))) return true;
  return false;
}
