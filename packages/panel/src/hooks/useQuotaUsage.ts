'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, type UsageSummary } from '../lib/api';
import type { PanelConfig } from '../config';

export function useQuotaUsage(apiBase?: PanelConfig['apiBase'], refreshKey = 0) {
  const [summary, setSummary] = useState<UsageSummary | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch<UsageSummary>('/api/keys/usage', undefined, { apiBase });
      setSummary(data);
    } catch {
      setSummary(null);
    }
  }, [apiBase]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 30_000);
    return () => clearInterval(timer);
  }, [refresh, refreshKey]);

  return { summary, refresh };
}
