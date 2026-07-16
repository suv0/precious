'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, type ProviderMeta } from '../lib/api';
import { RiskBadge } from '../components/RiskBadge';

const PROVIDER_ORDER = [
  'groq',
  'google-gemini',
  'openai',
  'mistral',
  'cerebras',
  'cloudflare',
  'github-models',
  'openrouter',
] as const;

export function WelcomePage() {
  const router = useRouter();
  const [providers, setProviders] = useState<ProviderMeta[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('groq');
  const [apiKey, setApiKey] = useState('');
  const [label, setLabel] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<{ keys: unknown[] }>('/api/keys'),
      apiFetch<{ providers: ProviderMeta[] }>('/api/keys/providers'),
    ])
      .then(([keysRes, providersRes]) => {
        if ((keysRes.keys as unknown[]).length > 0) {
          router.push('/chat');
          return;
        }
        const sorted = [...providersRes.providers].sort((a, b) => {
          const ai = PROVIDER_ORDER.indexOf(a.id as typeof PROVIDER_ORDER[number]);
          const bi = PROVIDER_ORDER.indexOf(b.id as typeof PROVIDER_ORDER[number]);
          if (ai === -1 && bi === -1) return 0;
          if (ai === -1) return 1;
          if (bi === -1) return -1;
          return ai - bi;
        });
        setProviders(sorted);
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [router]);

  const selected = providers.find((p) => p.id === selectedProvider);
  const needsKey = selected && !selected.keyless;

  const handleSubmit = useCallback(async () => {
    if (!selected) return;
    if (needsKey && !apiKey.trim()) return;

    setStatus('loading');
    setErrorMsg('');

    try {
      await apiFetch('/api/keys', {
        method: 'POST',
        body: JSON.stringify({
          providerId: selected.id,
          apiKey: apiKey.trim(),
          label: label.trim() || undefined,
        }),
      });
      setStatus('success');
      setTimeout(() => router.push('/chat'), 1200);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Failed to add key');
    }
  }, [selected, needsKey, apiKey, label, router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-precious-bg">
        <p className="text-precious-muted text-sm animate-pulse font-display">
          Setting up the vault…
        </p>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-precious-bg">
        <div className="precious-card p-10 max-w-md w-full text-center space-y-4">
          <div className="text-5xl mb-2">💎</div>
          <h2 className="font-display text-2xl text-precious-gold gold-glow">
            Key added to the vault
          </h2>
          <p className="text-precious-muted text-sm">
            Routing your first request…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-precious-bg p-4">
      <div className="precious-card p-8 max-w-md w-full space-y-6">
        <div className="text-center space-y-3">
          <span className="text-4xl">💍</span>
          <h1 className="font-display text-3xl font-semibold text-precious-gold gold-glow">
            Precious
          </h1>
          <h2 className="font-display text-xl text-precious-muted">
            One key to rule them all
          </h2>
          <p className="text-precious-muted text-sm max-w-xs mx-auto">
            Add a provider API key to get started. Precious handles the rest
            — routing, failover, and cost savings.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-precious-muted mb-1.5">
              Provider
            </label>
            <select
              className="precious-input py-2 text-sm"
              value={selectedProvider}
              onChange={(e) => {
                setSelectedProvider(e.target.value);
                setErrorMsg('');
              }}
            >
              {providers.map((p) => (
                <option
                  key={p.id}
                  value={p.id}
                  style={{ background: '#0a1612', color: '#e8f0ec' }}
                >
                  {p.name}{p.freeTier === false ? ' (paid)' : ''}
                </option>
              ))}
            </select>
          </div>

          {selected && (
            <>
              <div className="flex items-center gap-2">
                <RiskBadge level={selected.riskLevel} />
                {selected.freeTier && (
                  <span className="text-xs bg-emerald-900/40 text-emerald-400 px-2 py-0.5 rounded-full">
                    Free tier
                  </span>
                )}
                {selected.keyless && (
                  <span className="text-xs bg-precious-gold/20 text-precious-gold px-2 py-0.5 rounded-full">
                    No key needed
                  </span>
                )}
              </div>

              {selected.keySetupUrl && (
                <a
                  href={selected.keySetupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs text-precious-gold hover:underline"
                >
                  Get a {selected.name} API key →
                </a>
              )}
            </>
          )}

          {needsKey && (
            <div>
              <label className="block text-xs font-medium text-precious-muted mb-1.5">
                API key
              </label>
              <input
                type="password"
                className="precious-input py-2 text-sm"
                placeholder={`Paste your ${selected?.name ?? ''} API key`}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setErrorMsg('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmit();
                }}
                autoFocus
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-precious-muted mb-1.5">
              Label{' '}
              <span className="text-precious-muted/50">(optional)</span>
            </label>
            <input
              type="text"
              className="precious-input py-2 text-sm"
              placeholder={`My ${selected?.name ?? ''} key`}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          {status === 'error' && (
            <p className="text-xs text-red-400">{errorMsg}</p>
          )}

          <button
            type="button"
            className="precious-btn-primary w-full"
            disabled={status === 'loading' || (needsKey && !apiKey.trim())}
            onClick={handleSubmit}
          >
            {status === 'loading' ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                Verifying key…
              </span>
            ) : selected?.keyless ? (
              `Add ${selected.name}`
            ) : (
              `Add ${selected?.name ?? 'Provider'} key`
            )}
          </button>

          <p className="text-[11px] text-precious-muted/60 text-center">
            Keys are encrypted at rest. You can add more providers and models later.
          </p>
        </div>
      </div>
    </div>
  );
}
