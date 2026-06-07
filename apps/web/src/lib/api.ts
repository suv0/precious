const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error?.message ?? err.error ?? 'Request failed');
  }
  return res.json() as Promise<T>;
}

export interface ProviderMeta {
  id: string;
  name: string;
  riskLevel: 'low' | 'medium' | 'high';
  cloudSafe: boolean;
}

export interface ProviderKey {
  id: string;
  providerId: string;
  label: string;
  customBaseUrl?: string | null;
  meta?: ProviderMeta;
}

export interface FallbackEntry {
  providerId: string;
  model: string;
  priority: number;
  enabled: boolean;
}
