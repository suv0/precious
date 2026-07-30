/** Shared micro-copy — warm, fantasy-adjacent (see AGENTS.md). */

export const copy = {
  errors: {
    noProviderKeys:
      'One does not simply forge a Ring with an empty vault. Seal a provider key first.',
    tosRequired:
      'The vault will not open without your oath. Check the Terms box above — we insist.',
    cloudTrustRequired:
      'You must acknowledge cloud trust before we hold your keys. Read Security and check the box.',
    badProviderUrl:
      'The path to the provider is lost — remove and re-add your key, or set a valid base URL for custom providers.',
    generic: 'Something went awry between the Shire and Mordor. Try again.',
    healthCheck: 'The palantír clouded over. Health check failed.',
    keyTest: 'The test request failed. Try again.',
    addKey: 'The key would not take. Check your fields and try again.',
  },
  keys: {
    allProvidersConfigured:
      'Every listed provider already has a key. Use Replace on a row below, or Add backup for a second key on the same provider.',
    backupHint:
      'Backup keys: if one key hits a rate limit, Precious tries the next key on that provider before switching to another. Separate accounts work best; same-account keys may share quota.',
    backupTitle: 'Add backup key',
    ollamaSteps: [
      'Install Ollama from ollama.com/download (Windows/Mac/Linux). It usually starts automatically.',
      'Open a terminal and run: ollama pull llama3.2 (or any model name you want to use).',
      'Check it works: ollama list should show your model; the server listens on port 11434.',
      'In the form below — Label: anything (e.g. My Ollama). API key: ollama (any text; Ollama ignores it). Base URL: http://localhost:11434/v1 (include /v1).',
      'In Sanctum, pick Custom · llama3.2 (or the exact name from ollama list). Model names are case-sensitive.',
    ],
    ollamaBaseUrlHint:
      'Must end with /v1 — e.g. http://localhost:11434/v1. For LM Studio, use its “Local server” URL (often http://localhost:1234/v1).',
    ollamaApiKeyHint:
      'Not a real secret for local Ollama — type ollama so the field is filled. LM Studio often accepts lm-studio or any placeholder.',
    sealTitle: 'Seal a new secret',
    sealCta: 'Seal to vault',
    oneKeyTitle: 'The One Key',
    fallbackTitle: 'The Fallback Chain',
    vaultCapacity: 'Vault capacity',
  },
  success: {
    keyAdded: 'Secret sealed. The vault remembers.',
    keyReplaced: 'Key updated. The vault remembers your new secret.',
    unifiedGenerated:
      'Your prec_ master key is forged. Guard it — you only see it once.',
    chainSaved: 'Fallback order sealed. Failover shall follow your command.',
    healthCheck: 'All keys probed — see results below each row.',
    keyTest: (label: string) => `${label}: key is working.`,
  },
  warn: {
    unifiedNeedsKeys:
      'A Ring without a bearer goes nowhere. Seal at least one provider key so routing has someone to carry it.',
    chatNoKeys:
      'No keys in the vault — Sanctum stays quiet until you seal one in The Vault.',
  },
  failover:
    '{from} limit reached — continued on {to} with your full conversation. Second breakfast? Second provider.',
} as const;

export function failoverToast(from: string, to: string): string {
  return copy.failover.replace('{from}', from).replace('{to}', to);
}

const HEALTH_STATUS_LABELS: Record<string, string> = {
  healthy: 'working',
  rate_limited: 'rate limited',
  invalid: 'invalid key',
  unknown: 'could not verify',
};

export function healthStatusLabel(status?: string | null): string {
  return HEALTH_STATUS_LABELS[status ?? 'unknown'] ?? status ?? 'unknown';
}

export function formatHealthSummary(
  keys: Array<{ label: string; healthStatus?: string | null }>,
): string {
  if (keys.length === 0) return 'No keys to check.';
  const parts = keys.map((k) => `${k.label}: ${healthStatusLabel(k.healthStatus)}`);
  return parts.join(' · ');
}

export function healthRowMessage(
  label: string,
  status?: string | null,
  detail?: string,
): string {
  if (status === 'healthy') {
    return `${label}: responded OK to a tiny test request.`;
  }
  if (detail) return `${label}: ${detail}`;
  return `${label}: ${healthStatusLabel(status)}.`;
}

export function mapApiError(message: string, code?: string): string {
  if (code === 'no_provider_keys') return copy.errors.noProviderKeys;
  if (code === 'tos_required') return copy.errors.tosRequired;
  if (code === 'cloud_trust_required') return copy.errors.cloudTrustRequired;
  if (message.includes('Failed to parse URL') || message.includes('/chat/completions')) {
    return copy.errors.badProviderUrl;
  }
  if (message.includes('No models configured')) return copy.warn.chatNoKeys;
  if (message.includes('401') || message.includes('shall not pass')) {
    return 'You shall not pass… without a valid API key. Seal keys in The Vault.';
  }
  try {
    const parsed = JSON.parse(message) as { error?: { message?: string } };
    if (parsed.error?.message) return mapApiError(parsed.error.message);
  } catch {
    /* not JSON */
  }
  return message || copy.errors.generic;
}
