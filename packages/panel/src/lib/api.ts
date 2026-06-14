import type { PanelConfig } from '../config';

const API_BASE = '';

export class ApiError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  config?: Pick<PanelConfig, 'apiBase'>,
): Promise<T> {
  const base = config?.apiBase ?? API_BASE;
  const res = await fetch(`${base}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const message = err.error?.message ?? err.error ?? 'Request failed';
    throw new ApiError(message, err.code);
  }
  return res.json() as Promise<T>;
}

export interface ProviderMeta {
  id: string;
  name: string;
  riskLevel: 'low' | 'medium' | 'high';
  cloudSafe: boolean;
  keySetupUrl?: string;
  keySetupHint?: string;
  keySetupLinkLabel?: string;
  keyless?: boolean;
  freeTier?: boolean;
}

export interface ProviderKey {
  id: string;
  providerId: string;
  label: string;
  customBaseUrl?: string | null;
  healthStatus?: string | null;
  meta?: ProviderMeta;
}

export interface FallbackEntry {
  providerId: string;
  model: string;
  priority: number;
  enabled: boolean;
}

export interface ProviderUsageSegment {
  providerId: string;
  label: string;
  weightPercent: number;
  usedFraction: number;
  remainingFraction: number;
  usedToday: number;
  dailyLimit: number;
  usedThisMinute: number;
  minuteLimit: number;
  keyCount: number;
  tokensToday: number;
  tokenBudget: number;
  source?: 'live' | 'estimated';
}

export interface UsageSummary {
  segments: ProviderUsageSegment[];
  totalDailyLimit: number;
  totalUsedToday: number;
  totalTokensToday: number;
  totalTokenBudget: number;
  metric: 'tokens';
  resetsDayAt: number | null;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export const AUTO_MODEL = 'auto';
