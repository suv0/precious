/** Shared micro-copy — warm, fantasy-adjacent (see AGENTS.md). */

export const copy = {
  errors: {
    noProviderKeys:
      'One does not simply forge a Ring with an empty vault. Add a provider key first.',
    tosRequired:
      'The vault will not open without your oath. Check the Terms box above — we insist.',
    cloudTrustRequired:
      'You must acknowledge cloud trust before we hold your keys. Read Security and check the box.',
    badProviderUrl:
      'The path to the provider is lost — remove and re-add your key, or set a valid base URL for custom providers.',
    generic: 'Something went awry between the Shire and Mordor. Try again.',
    healthCheck: 'The palantír clouded over. Health check failed.',
    addKey: 'The key would not take. Check your fields and try again.',
  },
  success: {
    keyAdded: 'Key added. Keeping it safe, yesss.',
    unifiedGenerated:
      'Your prec_ key is forged. Guard it — unlike certain hobbits, you only see it once.',
    chainSaved: 'The fellowship order is set. Failover shall follow your command.',
    healthCheck: 'The palantír has spoken. Key health updated.',
  },
  warn: {
    unifiedNeedsKeys:
      'A Ring without a bearer goes nowhere. Add at least one provider key so routing has someone to carry it.',
    chatNoKeys:
      'No keys in the vault — chat cannot leave the Shire until you add one in Keys & routing.',
  },
  failover:
    '{from} limit reached — continued on {to} with your full conversation. Second breakfast? Second provider.',
} as const;

export function failoverToast(from: string, to: string): string {
  return copy.failover.replace('{from}', from).replace('{to}', to);
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
    return 'You shall not pass… without a valid API key. Add keys in Settings.';
  }
  try {
    const parsed = JSON.parse(message) as { error?: { message?: string } };
    if (parsed.error?.message) return mapApiError(parsed.error.message);
  } catch {
    /* not JSON */
  }
  return message || copy.errors.generic;
}
