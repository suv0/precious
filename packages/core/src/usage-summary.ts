import type { ProviderId } from './types.js';
import { DEFAULT_KEY_RATE_LIMITS, getProviderDailyLimit, getProviderTokenBudget } from './key-health.js';
import type { KeyUsageSnapshot } from './per-key-rate.js';

export interface ProviderUsageSegment {
  providerId: ProviderId;
  label: string;
  /** Share of the combined bar width (0–100). */
  weightPercent: number;
  /** Fraction of this provider's daily token budget consumed (0–1). */
  usedFraction: number;
  /** Fraction remaining (0–1). */
  remainingFraction: number;
  usedToday: number;
  dailyLimit: number;
  usedThisMinute: number;
  minuteLimit: number;
  keyCount: number;
  /** Tokens consumed today (prompt + completion). */
  tokensToday: number;
  /** Estimated daily token budget for this provider. */
  tokenBudget: number;
  source?: 'live' | 'estimated';
}

export interface UsageSummary {
  segments: ProviderUsageSegment[];
  totalDailyLimit: number;
  totalUsedToday: number;
  /** Total tokens consumed today across all providers. */
  totalTokensToday: number;
  /** Total token budget across all providers. */
  totalTokenBudget: number;
  /** What the bar represents. */
  metric: 'tokens';
  resetsDayAt: number | null;
}

const PROVIDER_LABELS: Record<string, string> = {
  groq: 'Groq',
  'google-gemini': 'Gemini',
  openrouter: 'OpenRouter',
  mistral: 'Mistral',
  openai: 'OpenAI',
  'openai-compat': 'Custom',
};

export function providerUsageLabel(providerId: string): string {
  return PROVIDER_LABELS[providerId] ?? providerId;
}

interface KeyUsageRow {
  providerId: ProviderId;
  snapshot?: KeyUsageSnapshot;
}

/**
 * Build stacked capacity segments for the multi-provider "battery" bar.
 * Bar width ∝ token budget; fill ∝ tokens consumed today.
 */
export function buildUsageSummary(
  keys: KeyUsageRow[],
  now = Date.now(),
  limits = DEFAULT_KEY_RATE_LIMITS,
): UsageSummary {
  const byProvider = new Map<
    string,
    {
      usedToday: number;
      usedMinute: number;
      dailyLimit: number;
      dayStart: number;
      keyCount: number;
      tokenBudget: number;
      tokensToday: number;
    }
  >();

  for (const key of keys) {
    const snap = key.snapshot;
    let dayCount = snap?.dayCount ?? 0;
    let minuteCount = snap?.minuteCount ?? 0;
    let dayStart = snap?.dayWindowStart ?? now;
    let minuteStart = snap?.minuteWindowStart ?? now;

    if (snap && now - dayStart >= 86_400_000) {
      dayCount = 0;
      dayStart = now;
    }
    if (snap && now - minuteStart >= 60_000) {
      minuteCount = 0;
    }

    const providerLimit = getProviderDailyLimit(key.providerId);
    const tokenBudget = getProviderTokenBudget(key.providerId);

    const existing = byProvider.get(key.providerId) ?? {
      usedToday: 0,
      usedMinute: 0,
      dailyLimit: 0,
      dayStart,
      keyCount: 0,
      tokenBudget: 0,
      tokensToday: 0,
    };
    existing.usedToday += dayCount;
    existing.usedMinute += minuteCount;
    existing.dailyLimit += providerLimit;
    existing.tokenBudget += tokenBudget;
    existing.tokensToday += snap?.tokensToday ?? 0;
    existing.keyCount += 1;
    existing.dayStart = Math.min(existing.dayStart, dayStart);
    byProvider.set(key.providerId, existing);
  }

  const entries = [...byProvider.entries()];
  const totalDailyLimit = entries.reduce((s, [, v]) => s + v.dailyLimit, 0);
  const totalUsedToday = entries.reduce((s, [, v]) => s + v.usedToday, 0);
  const totalTokenBudget = entries.reduce((s, [, v]) => s + v.tokenBudget, 0);
  const totalTokensToday = entries.reduce((s, [, v]) => s + v.tokensToday, 0);

  const segments: ProviderUsageSegment[] = entries.map(([providerId, v]) => {
    const usedFraction = v.tokenBudget > 0 ? Math.min(1, v.tokensToday / v.tokenBudget) : 0;
    return {
      providerId: providerId as ProviderId,
      label: providerUsageLabel(providerId),
      weightPercent: totalTokenBudget > 0 ? (v.tokenBudget / totalTokenBudget) * 100 : 0,
      usedFraction,
      remainingFraction: 1 - usedFraction,
      usedToday: v.usedToday,
      dailyLimit: v.dailyLimit,
      usedThisMinute: v.usedMinute,
      minuteLimit: limits.requestsPerMinute * v.keyCount,
      keyCount: v.keyCount,
      tokensToday: v.tokensToday,
      tokenBudget: v.tokenBudget,
    };
  });

  const earliestDayStart =
    entries.length > 0 ? Math.min(...entries.map(([, v]) => v.dayStart)) : null;

  return {
    segments,
    totalDailyLimit,
    totalUsedToday,
    totalTokensToday,
    totalTokenBudget,
    metric: 'tokens',
    resetsDayAt: earliestDayStart != null ? earliestDayStart + 86_400_000 : null,
  };
}
