export type KeyHealthStatus = 'healthy' | 'rate_limited' | 'invalid' | 'unknown';

/** Default per-key limits aligned with typical free-tier hobby use */
export const DEFAULT_KEY_RATE_LIMITS = {
  requestsPerMinute: 30,
  requestsPerDay: 14_400,
} as const;

/** Realistic free-tier daily limits per provider. Falls back to DEFAULT_KEY_RATE_LIMITS. */
export const PROVIDER_DAILY_LIMITS: Record<string, number> = {
  groq: 14_400,           // ~10 RPM free tier
  'google-gemini': 1_500, // Free tier: ~1,500 RPD
  cerebras: 14_400,       // Generous free tier
  cloudflare: 10_000,     // Workers AI free: 10k neurons/day ≈ many requests
  'github-models': 5_000, // GitHub free tier
  openrouter: 200,        // Free models share global capacity — tiny
  mistral: 14_400,        // Mistral free tier
  openai: 200,             // Free tier: ~200 RPD on gpt-4o-mini
  huggingface: 1_000,     // ~$0.10/mo free credit
  'ollama-cloud': 500,    // Free plan: small GPU quota
  opencode: 500,          // Free promotional tier
  zhipu: 1_000,           // GLM free tier
  llm7: 600,              // ~100 req/hr free
  cohere: 1_000,          // Trial tier
  nvidia: 100,            // Eval-only, very limited
  pollinations: 1_000,    // Anonymous tier
  kilo: 1_200,            // :free routes ~200 req/hr
  'openai-compat': 14_400, // Local — effectively unlimited
};

export function getProviderDailyLimit(providerId: string): number {
  return PROVIDER_DAILY_LIMITS[providerId] ?? DEFAULT_KEY_RATE_LIMITS.requestsPerDay;
}

/** Estimated daily token budgets per provider per key based on typical free-tier allowances. */
export const PROVIDER_TOKEN_BUDGETS: Record<string, number> = {
  groq: 500_000,
  'google-gemini': 1_500_000,
  cerebras: 1_000_000,
  cloudflare: 500_000,
  'github-models': 500_000,
  openrouter: 100_000,
  mistral: 500_000,
  openai: 100_000,
  huggingface: 100_000,
  'ollama-cloud': 100_000,
  opencode: 50_000,
  zhipu: 200_000,
  llm7: 100_000,
  cohere: 100_000,
  nvidia: 50_000,
  pollinations: 100_000,
  kilo: 200_000,
  'openai-compat': 100_000_000,
};

const DEFAULT_TOKEN_BUDGET = 500_000;

export function getProviderTokenBudget(providerId: string): number {
  return PROVIDER_TOKEN_BUDGETS[providerId] ?? DEFAULT_TOKEN_BUDGET;
}

/** Map upstream HTTP/auth errors to health status */
export function healthFromError(err: unknown): KeyHealthStatus {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  if (msg.includes('401') || msg.includes('403') || msg.includes('invalid') || msg.includes('unauthorized')) {
    return 'invalid';
  }
  if (msg.includes('429') || msg.includes('rate limit')) {
    return 'rate_limited';
  }
  return 'unknown';
}

export function isKeyHealthyForRouting(status: KeyHealthStatus | null | undefined): boolean {
  return status === 'healthy' || status === 'unknown' || status == null;
}
