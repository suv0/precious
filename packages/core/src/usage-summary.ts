import type { ProviderId } from './types.js';
import { DEFAULT_KEY_RATE_LIMITS } from './key-health.js';
import type { KeyUsageSnapshot } from './per-key-rate.js';

export interface ProviderUsageSegment {
  providerId: ProviderId;
  label: string;
  /** Share of the combined bar width (0–100). */
  weightPercent: number;
  /** Fraction of this provider's daily budget consumed (0–1). */
  usedFraction: number;
  /** Fraction remaining (0–1). */
  remainingFraction: number;
  usedToday: number;
  dailyLimit: number;
  usedThisMinute: number;
  minuteLimit: number;
  keyCount: number;
}

export interface UsageSummary {
  segments: ProviderUsageSegment[];
  totalDailyLimit: number;
  totalUsedToday: number;
  /** What the bar represents — honest labeling for UI. */
  metric: 'requests';
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
 * Each provider's width ∝ its daily request budget; fill ∝ requests used today.
 */
export function buildUsageSummary(
  keys: KeyUsageRow[],
  now = Date.now(),
  limits = DEFAULT_KEY_RATE_LIMITS,
): UsageSummary {
  const byProvider = new Map<
    string,
    { usedToday: number; usedMinute: number; dailyLimit: number; keyCount: number; dayStart: number }
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

    const existing = byProvider.get(key.providerId) ?? {
      usedToday: 0,
      usedMinute: 0,
      dailyLimit: 0,
      keyCount: 0,
      dayStart,
    };
    existing.usedToday += dayCount;
    existing.usedMinute += minuteCount;
    existing.dailyLimit += limits.requestsPerDay ?? 14_400;
    existing.keyCount += 1;
    existing.dayStart = Math.min(existing.dayStart, dayStart);
    byProvider.set(key.providerId, existing);
  }

  const entries = [...byProvider.entries()];
  const totalDailyLimit = entries.reduce((s, [, v]) => s + v.dailyLimit, 0);
  const totalUsedToday = entries.reduce((s, [, v]) => s + v.usedToday, 0);

  const segments: ProviderUsageSegment[] = entries.map(([providerId, v]) => {
    const usedFraction =
      v.dailyLimit > 0 ? Math.min(1, v.usedToday / v.dailyLimit) : 0;
    return {
      providerId: providerId as ProviderId,
      label: providerUsageLabel(providerId),
      weightPercent: totalDailyLimit > 0 ? (v.dailyLimit / totalDailyLimit) * 100 : 0,
      usedFraction,
      remainingFraction: 1 - usedFraction,
      usedToday: v.usedToday,
      dailyLimit: v.dailyLimit,
      usedThisMinute: v.usedMinute,
      minuteLimit: limits.requestsPerMinute * v.keyCount,
      keyCount: v.keyCount,
    };
  });

  const earliestDayStart =
    entries.length > 0 ? Math.min(...entries.map(([, v]) => v.dayStart)) : null;

  return {
    segments,
    totalDailyLimit,
    totalUsedToday,
    metric: 'requests',
    resetsDayAt: earliestDayStart != null ? earliestDayStart + 86_400_000 : null,
  };
}
