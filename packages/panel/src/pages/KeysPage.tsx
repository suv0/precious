'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PanelLayout } from '../components/PanelLayout';
import { QuestBanner } from '../components/QuestBanner';
import { RiskBadge, HealthDot } from '../components/RiskBadge';
import { usePanelConfig } from '../config';
import {
  apiFetch,
  ApiError,
  type ProviderKey,
  type FallbackEntry,
  type ProviderMeta,
} from '../lib/api';
import { copy, mapApiError } from '../lib/copy';
import { QuotaCapacityBar } from '../components/QuotaCapacityBar';
import { useQuotaUsage } from '../hooks/useQuotaUsage';

type Banner = { variant: 'success' | 'error' | 'warn'; text: string };

export function KeysPage() {
  const { apiBase, requireAuth, onAuthRequired, legalLinks } = usePanelConfig();
  const [keys, setKeys] = useState<ProviderKey[]>([]);
  const [providers, setProviders] = useState<ProviderMeta[]>([]);
  const [chain, setChain] = useState<FallbackEntry[]>([]);
  const [tosAck, setTosAck] = useState(false);
  const [needsTos, setNeedsTos] = useState(true);
  const [needsCloudTrust, setNeedsCloudTrust] = useState(false);
  const [cloudTrust, setCloudTrust] = useState(false);
  const [newKey, setNewKey] = useState({
    providerId: 'groq',
    label: '',
    apiKey: '',
    customBaseUrl: '',
  });
  const [unifiedKey, setUnifiedKey] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [probing, setProbing] = useState(false);

  const fetchOpts = { apiBase };
  const hasProviderKeys = keys.length > 0;
  const { summary: quotaSummary } = useQuotaUsage(apiBase);

  useEffect(() => {
    Promise.all([
      apiFetch<{ keys: ProviderKey[] }>('/api/keys', undefined, fetchOpts),
      apiFetch<{ providers: ProviderMeta[] }>('/api/keys/providers', undefined, fetchOpts),
      apiFetch<{ chain: FallbackEntry[] }>('/api/fallback-chain', undefined, fetchOpts),
      apiFetch<{
        tosAcknowledged: boolean;
        cloudTrustAcknowledged?: boolean;
      }>('/api/keys/settings', undefined, fetchOpts),
    ])
      .then(([k, p, c, s]) => {
        setKeys(k.keys);
        setProviders(p.providers);
        setChain(c.chain);
        setNeedsTos(!s.tosAcknowledged);
        setTosAck(s.tosAcknowledged);
        setNeedsCloudTrust(requireAuth && !s.cloudTrustAcknowledged);
        setCloudTrust(s.cloudTrustAcknowledged ?? false);
      })
      .catch(() => {
        if (requireAuth && onAuthRequired) onAuthRequired();
      });
  }, [apiBase, requireAuth, onAuthRequired]);

  function showBanner(variant: Banner['variant'], text: string) {
    setBanner({ variant, text });
  }

  async function addKey(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);

    if (needsTos && !tosAck) {
      showBanner('error', copy.errors.tosRequired);
      return;
    }
    if (needsCloudTrust && !cloudTrust) {
      showBanner('error', copy.errors.cloudTrustRequired);
      return;
    }

    try {
      await apiFetch(
        '/api/keys',
        {
          method: 'POST',
          body: JSON.stringify({
            providerId: newKey.providerId,
            label: newKey.label,
            apiKey: newKey.apiKey,
            ...(newKey.providerId === 'openai-compat' && newKey.customBaseUrl.trim()
              ? { customBaseUrl: newKey.customBaseUrl.trim() }
              : {}),
            tosAcknowledged: needsTos ? tosAck : undefined,
            cloudTrustAcknowledged: needsCloudTrust ? cloudTrust : undefined,
          }),
        },
        fetchOpts,
      );
      setNewKey({ providerId: 'groq', label: '', apiKey: '', customBaseUrl: '' });
      setNeedsTos(false);
      setNeedsCloudTrust(false);
      const [k, c] = await Promise.all([
        apiFetch<{ keys: ProviderKey[] }>('/api/keys', undefined, fetchOpts),
        apiFetch<{ chain: FallbackEntry[] }>('/api/fallback-chain', undefined, fetchOpts),
      ]);
      setKeys(k.keys);
      setChain(c.chain);
      showBanner('success', copy.success.keyAdded);
    } catch (err) {
      showBanner(
        'error',
        err instanceof ApiError
          ? mapApiError(err.message, err.code)
          : copy.errors.addKey,
      );
    }
  }

  async function deleteKey(id: string) {
    await apiFetch(`/api/keys/${id}`, { method: 'DELETE' }, fetchOpts);
    setKeys((prev) => prev.filter((k) => k.id !== id));
  }

  async function generateUnified() {
    setBanner(null);
    if (!hasProviderKeys) {
      showBanner('error', copy.errors.noProviderKeys);
      return;
    }
    try {
      const res = await apiFetch<{ key: string; message: string }>(
        '/api/keys/unified',
        { method: 'POST' },
        fetchOpts,
      );
      setUnifiedKey(res.key);
      showBanner('success', copy.success.unifiedGenerated);
    } catch (err) {
      showBanner(
        'error',
        err instanceof ApiError
          ? mapApiError(err.message, err.code)
          : copy.errors.generic,
      );
    }
  }

  async function saveChain() {
    await apiFetch(
      '/api/fallback-chain',
      { method: 'PUT', body: JSON.stringify({ chain }) },
      fetchOpts,
    );
    showBanner('success', copy.success.chainSaved);
  }

  async function runHealthCheck() {
    setProbing(true);
    setBanner(null);
    try {
      const res = await apiFetch<{ keys: ProviderKey[] }>(
        '/api/keys/health-check',
        { method: 'POST' },
        fetchOpts,
      );
      setKeys(res.keys);
      showBanner('success', copy.success.healthCheck);
    } catch (err) {
      showBanner(
        'error',
        err instanceof Error ? err.message : copy.errors.healthCheck,
      );
    } finally {
      setProbing(false);
    }
  }

  function moveChain(idx: number, dir: -1 | 1) {
    const next = [...chain];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setChain(next.map((e, i) => ({ ...e, priority: i })));
  }

  const canSubmitKey =
    (!needsTos || tosAck) && (!needsCloudTrust || cloudTrust);

  const selectedProvider =
    providers.find((p) => p.id === newKey.providerId) ?? providers[0];

  const docsAnchor =
    newKey.providerId === 'google-gemini'
      ? 'google-gemini'
      : newKey.providerId === 'openai-compat'
        ? 'custom'
        : newKey.providerId;

  return (
    <PanelLayout>
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">
        <div>
          <h1 className="font-display text-3xl text-precious-gold">Keys & routing</h1>
          {legalLinks && (
            <p className="text-precious-muted text-sm mt-1">
              Read{' '}
              <Link href={legalLinks.legal} className="text-precious-gold hover:underline">
                Legal / ToS
              </Link>{' '}
              before adding keys.
            </p>
          )}
        </div>

        {banner && <QuestBanner variant={banner.variant}>{banner.text}</QuestBanner>}

        {hasProviderKeys && (
          <section className="precious-card p-5">
            <QuotaCapacityBar summary={quotaSummary} />
            <p className="text-[11px] text-precious-muted/80 mt-3 leading-relaxed">
              Bar width = each provider&apos;s share of your combined daily budget. Color drains as
              Precious routes requests through that key. Google/Groq may enforce their own limits
              separately — this is your local routing meter.
            </p>
          </section>
        )}

        <section className="precious-card p-6">
          <h2 className="font-display text-lg text-precious-text mb-4">Unified API key</h2>
          <p className="text-sm text-precious-muted mb-4">
            Prefix <code className="text-precious-gold">prec_</code> — use in Cursor, Python, LangChain.
            Routes through your provider keys below; useless without them.
          </p>
          {!hasProviderKeys && !unifiedKey && (
            <QuestBanner variant="warn">{copy.warn.unifiedNeedsKeys}</QuestBanner>
          )}
          {unifiedKey ? (
            <div className="mt-4 bg-precious-bg rounded-lg p-4 font-mono text-sm text-precious-gold break-all">
              {unifiedKey}
              <p className="text-red-300 text-xs mt-2 font-display">
                Copy now — shown once only. Lose it and you must forge anew.
              </p>
            </div>
          ) : (
            <button
              onClick={generateUnified}
              className="precious-btn-gold mt-4 disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={!hasProviderKeys}
              title={!hasProviderKeys ? copy.warn.unifiedNeedsKeys : undefined}
            >
              Generate prec_ key
            </button>
          )}
        </section>

        <section className="precious-card p-6">
          <h2 className="font-display text-lg text-precious-text mb-4">Add provider key</h2>
          {needsCloudTrust && legalLinks && (
            <div className="mb-4 p-4 rounded-lg border border-amber-800/50 bg-amber-950/30 text-sm text-precious-muted space-y-3">
              <p>
                <strong className="text-precious-text">You are trusting us with secrets.</strong>{' '}
                Provider keys are encrypted at rest, but you are storing them on our servers.
              </p>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={cloudTrust}
                  onChange={(e) => setCloudTrust(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  I understand the tradeoffs and have read{' '}
                  <Link href={legalLinks.security} className="text-precious-gold">Security</Link>,{' '}
                  <Link href={legalLinks.privacy} className="text-precious-gold">Privacy</Link>, and{' '}
                  <Link href={legalLinks.legal} className="text-precious-gold">Legal</Link>.
                </span>
              </label>
            </div>
          )}
          {needsTos && legalLinks && (
            <label className="flex items-start gap-3 mb-4 text-sm text-precious-muted">
              <input type="checkbox" checked={tosAck} onChange={(e) => setTosAck(e.target.checked)} className="mt-1" />
              <span>
                I own these API keys and accept each provider&apos;s Terms of Service. I have read{' '}
                <Link href={legalLinks.security} className="text-precious-gold">Security</Link>,{' '}
                <Link href={legalLinks.privacy} className="text-precious-gold">Privacy</Link>, and{' '}
                <Link href={legalLinks.legal} className="text-precious-gold">Legal</Link>.
              </span>
            </label>
          )}
          {needsTos && !legalLinks && (
            <label className="flex items-start gap-3 mb-4 text-sm text-precious-muted">
              <input type="checkbox" checked={tosAck} onChange={(e) => setTosAck(e.target.checked)} className="mt-1" />
              <span>I own these API keys and accept each provider&apos;s Terms of Service.</span>
            </label>
          )}
          <form onSubmit={addKey} className="space-y-3">
            <select
              className="precious-input"
              value={newKey.providerId}
              onChange={(e) => setNewKey({ ...newKey, providerId: e.target.value })}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.riskLevel} risk)
                </option>
              ))}
            </select>

            {selectedProvider?.keySetupUrl && (
              <div className="rounded-lg border border-emerald-900/50 bg-precious-bg/60 px-4 py-3 text-sm space-y-2">
                <p className="text-precious-muted">
                  {selectedProvider.keySetupHint ?? 'Create an API key at the provider, then paste it below.'}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <a
                    href={selectedProvider.keySetupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-precious-gold hover:underline font-display"
                  >
                    Get {selectedProvider.name} API key →
                  </a>
                  <Link
                    href={`/docs#${docsAnchor}`}
                    className="text-precious-muted hover:text-precious-gold hover:underline"
                  >
                    Step-by-step guide
                  </Link>
                </div>
              </div>
            )}

            <input
              className="precious-input"
              placeholder="Label (e.g. My Groq key)"
              value={newKey.label}
              onChange={(e) => setNewKey({ ...newKey, label: e.target.value })}
              required
            />
            <input
              className="precious-input font-mono"
              placeholder="API key"
              type="password"
              value={newKey.apiKey}
              onChange={(e) => setNewKey({ ...newKey, apiKey: e.target.value })}
              required
            />
            {newKey.providerId === 'openai-compat' && (
              <input
                className="precious-input"
                placeholder="Base URL (e.g. http://localhost:11434/v1)"
                value={newKey.customBaseUrl}
                onChange={(e) => setNewKey({ ...newKey, customBaseUrl: e.target.value })}
              />
            )}
            <button type="submit" className="precious-btn-primary">
              Add key
            </button>
            {!canSubmitKey && (
              <p className="text-xs text-amber-200/90 font-display">
                Check the Terms box above to unlock the vault.
              </p>
            )}
          </form>
        </section>

        <section className="precious-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg text-precious-text">Your keys</h2>
            {keys.length > 0 && (
              <button
                onClick={runHealthCheck}
                disabled={probing}
                className="text-sm text-precious-gold hover:underline disabled:opacity-50"
              >
                {probing ? 'Consulting the palantír…' : 'Run health check'}
              </button>
            )}
          </div>
          {keys.length === 0 ? (
            <p className="text-precious-muted text-sm font-display italic">
              No keys yet. The vault is empty — add one above.
            </p>
          ) : (
            <ul className="space-y-3">
              {keys.map((k) => (
                <li
                  key={k.id}
                  className="flex items-center justify-between gap-4 border-b border-emerald-900/30 pb-3"
                >
                  <div className="flex items-center gap-2">
                    <HealthDot status={k.healthStatus} />
                    <div>
                      <span className="text-precious-text">{k.label}</span>
                      <span className="text-precious-muted text-sm ml-2">{k.providerId}</span>
                      {k.meta && <RiskBadge level={k.meta.riskLevel} />}
                    </div>
                  </div>
                  <button onClick={() => deleteKey(k.id)} className="text-red-400 text-sm hover:underline">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {chain.length > 0 && (
          <section className="precious-card p-6">
            <h2 className="font-display text-lg text-precious-text mb-4">Fallback chain</h2>
            <ul className="space-y-2">
              {chain.map((e, i) => (
                <li key={`${e.providerId}-${e.model}`} className="flex items-center gap-3 text-sm">
                  <span className="text-precious-muted w-6">{i + 1}.</span>
                  <span className="text-precious-text flex-1">
                    {e.providerId} / {e.model}
                  </span>
                  <button type="button" onClick={() => moveChain(i, -1)} className="text-precious-gold">↑</button>
                  <button type="button" onClick={() => moveChain(i, 1)} className="text-precious-gold">↓</button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={saveChain} className="precious-btn-gold mt-4">
              Save order
            </button>
          </section>
        )}
      </div>
    </PanelLayout>
  );
}
