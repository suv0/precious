export interface ChatErrorDisplay {
  title: string;
  lines: string[];
  hint?: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  groq: 'Groq',
  'google-gemini': 'Google Gemini',
  openrouter: 'OpenRouter',
  mistral: 'Mistral',
  'openai-compat': 'Custom provider',
};

function unwrapMessage(raw: string): string {
  let message = raw.trim();
  try {
    const parsed = JSON.parse(message) as { error?: { message?: string }; message?: string };
    message = parsed.error?.message ?? parsed.message ?? message;
  } catch {
    /* plain text */
  }
  return message.replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
}

function labelProvider(id: string): string {
  return PROVIDER_LABELS[id] ?? id.replace(/-/g, ' ');
}

function shortenProviderDetail(detail: string, model?: string): string {
  const lower = detail.toLowerCase();
  if (lower.includes('429') || lower.includes('quota') || lower.includes('rate limit')) {
    const modelNote = model ? ` (${model})` : '';
    return `Rate limit or free-tier quota exceeded${modelNote}. The key may be valid but this model has no remaining quota.`;
  }
  if (lower.includes('401') || lower.includes('invalid') || lower.includes('api key')) {
    return 'Invalid or rejected API key — double-check you pasted the full key.';
  }
  if (lower.includes('403')) {
    return 'Access denied — the key may lack permission for this model.';
  }

  const jsonStart = detail.indexOf('{');
  if (jsonStart >= 0) {
    try {
      const blob = JSON.parse(detail.slice(jsonStart)) as {
        error?: { message?: string };
        message?: string;
      };
      const inner = blob.error?.message ?? blob.message;
      if (inner) return shortenProviderDetail(inner, model);
    } catch {
      /* fall through */
    }
  }

  const cleaned = detail
    .replace(/^[^:]+:\s*/i, '')
    .replace(/\s*https?:\/\/\S+/g, '')
    .trim();

  if (cleaned.length > 160) {
    return `${cleaned.slice(0, 157)}…`;
  }
  return cleaned || 'Request failed.';
}

function formatProviderChunk(chunk: string): string | null {
  if (!chunk) return null;
  const routeMatch = chunk.match(/^([\w-]+)\/([^:]+):\s*(.+)$/i);
  if (routeMatch) {
    const [, providerId, model, detail] = routeMatch;
    const summary = shortenProviderDetail(detail, model);
    return `${labelProvider(providerId)} · ${model}: ${summary}`;
  }
  return shortenProviderDetail(chunk);
}

export function formatChatError(raw: string): ChatErrorDisplay {
  const message = unwrapMessage(raw);
  const lower = message.toLowerCase();

  const exhausted = message.match(/all providers exhausted after (\d+) attempts\.?\s*(.*)/i);
  if (exhausted) {
    const count = Number(exhausted[1]);
    const chunks = exhausted[2]
      .split(';')
      .map((c) => formatProviderChunk(c.trim()))
      .filter((c): c is string => Boolean(c));

    const quotaHit = lower.includes('429') || lower.includes('quota');
    return {
      title:
        count <= 1
          ? 'No provider could complete your request'
          : `All ${count} routing attempts failed`,
      lines:
        chunks.length > 0
          ? chunks
          : ['Every configured provider returned an error.'],
      hint: quotaHit
        ? 'A valid key can still hit zero free-tier quota (common on Gemini 2.0 Flash). Add a Groq key under Keys for failover, or edit your fallback chain to use gemini-2.5-flash.'
        : 'Add a second provider under Keys so Precious can failover when one fails.',
    };
  }

  if (lower.includes('429') || lower.includes('quota') || lower.includes('rate limit')) {
    const limitZero = /limit:\s*0/i.test(message);
    return {
      title: limitZero ? 'This model is not on your free tier' : 'Rate limit reached',
      lines: [
        limitZero
          ? 'Google returned quota limit 0 — that means this model has no free allocation on your account, not that you used up a fresh key.'
          : shortenProviderDetail(message),
      ],
      hint: limitZero
        ? 'In AI Studio → your key → Rate limits, check which models show limit 0. Use gemini-2.5-flash or gemini-2.5-flash-lite, add a Groq key for failover, or enable billing in Google Cloud (free tier still applies).'
        : 'Wait a minute and retry, add another provider key, or try a different model in your fallback chain.',
    };
  }

  if (lower.includes('no models configured')) {
    return {
      title: 'Nothing to route to',
      lines: ['Add at least one provider key under Keys & routing.'],
    };
  }

  return {
    title: 'Could not get a reply',
    lines: [shortenProviderDetail(message)],
  };
}
