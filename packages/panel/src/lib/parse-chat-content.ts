export interface ChatResponseMeta {
  provider?: string | null;
  model?: string | null;
  tokens?: number | null;
}

export interface ParsedChatContent {
  text: string;
  meta?: ChatResponseMeta;
}

const PROVIDER_LABELS: Record<string, string> = {
  groq: 'Groq',
  'google-gemini': 'Gemini',
  openrouter: 'OpenRouter',
  mistral: 'Mistral',
  openai: 'OpenAI',
  'openai-compat': 'Custom',
};

export function labelProvider(id: string): string {
  return PROVIDER_LABELS[id] ?? id.replace(/-/g, ' ');
}

/** Extract human-readable reply text when a raw OpenAI JSON body was stored as content. */
export function parseChatContent(raw: string): ParsedChatContent {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{')) {
    return { text: raw };
  }

  try {
    const body = JSON.parse(trimmed) as {
      object?: string;
      model?: string;
      choices?: Array<{ message?: { content?: string | null } }>;
      usage?: { total_tokens?: number };
      precious?: { provider?: string; model?: string };
    };

    if (body.object === 'chat.completion' && Array.isArray(body.choices)) {
      const text = body.choices[0]?.message?.content;
      if (typeof text === 'string') {
        return {
          text,
          meta: {
            provider: body.precious?.provider ?? null,
            model: body.precious?.model ?? body.model ?? null,
            tokens: body.usage?.total_tokens ?? null,
          },
        };
      }
    }
  } catch {
    /* plain text that happens to start with { */
  }

  return { text: raw };
}

export function formatResponseMeta(meta: ChatResponseMeta): string | null {
  const parts: string[] = [];
  if (meta.provider) parts.push(labelProvider(meta.provider));
  if (meta.model) parts.push(meta.model);
  if (meta.tokens != null && !Number.isNaN(meta.tokens)) {
    parts.push(`${meta.tokens.toLocaleString()} tokens`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}
