'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { copy, formatHealthSummary, healthRowMessage, mapApiError } from '../lib/copy';
import { QuotaCapacityBar } from '../components/QuotaCapacityBar';
import { useQuotaUsage } from '../hooks/useQuotaUsage';

type Banner = { variant: 'success' | 'error' | 'warn'; text: string };
type KeyFeedback = { variant: Banner['variant']; text: string };
type AddMode = 'new' | 'backup';

function feedbackTextClass(variant: Banner['variant']): string {
  if (variant === 'success') return 'text-emerald-300/90';
  if (variant === 'warn') return 'text-amber-300/90';
  return 'text-red-300/90';
}

const emptyNewKey = (providerId: string) => ({
  providerId,
  label: '',
  apiKey: '',
  customBaseUrl: '',
});

export function KeysPage() {
  const { apiBase, requireAuth, onAuthRequired, legalLinks } = usePanelConfig();
  const [keys, setKeys] = useState<ProviderKey[]>([]);
  const [providers, setProviders] = useState<ProviderMeta[]>([]);
  const [chain, setChain] = useState<FallbackEntry[]>([]);
  const [tosAck, setTosAck] = useState(false);
  const [needsTos, setNeedsTos] = useState(true);
  const [needsCloudTrust, setNeedsCloudTrust] = useState(false);
  const [cloudTrust, setCloudTrust] = useState(false);
  const [newKey, setNewKey] = useState(emptyNewKey('groq'));
  const [addMode, setAddMode] = useState<AddMode>('new');
  const [replacingKeyId, setReplacingKeyId] = useState<string | null>(null);
  const [replaceForm, setReplaceForm] = useState({
    apiKey: '',
    label: '',
    customBaseUrl: '',
  });
  const [unifiedKey, setUnifiedKey] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [probing, setProbing] = useState(false);
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null);
  const [keyFeedback, setKeyFeedback] = useState<Record<string, KeyFeedback>>({});
  const [healthSummary, setHealthSummary] = useState<string | null>(null);
  const addSectionRef = useRef<HTMLElement>(null);
  const keysSectionRef = useRef<HTMLElement>(null);

  const fetchOpts = { apiBase };
  const hasProviderKeys = keys.length > 0;
  const { summary: quotaSummary } = useQuotaUsage(apiBase);

  const providersWithoutKey = useMemo(
    () => providers.filter((p) => !keys.some((k) => k.providerId === p.id)),
    [providers, keys],
  );

  const showAddForm =
    addMode === 'backup' || providersWithoutKey.length > 0;

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

  useEffect(() => {
    if (addMode !== 'new' || providersWithoutKey.length === 0) return;
    if (!providersWithoutKey.some((p) => p.id === newKey.providerId)) {
      setNewKey((prev) => ({ ...prev, providerId: providersWithoutKey[0]!.id }));
    }
  }, [addMode, providersWithoutKey, newKey.providerId]);

  function showBanner(variant: Banner['variant'], text: string) {
    setBanner({ variant, text });
  }

  function resetAddForm() {
    setAddMode('new');
    setNewKey(emptyNewKey(providersWithoutKey[0]?.id ?? providers[0]?.id ?? 'groq'));
  }

  function startBackup(providerId: string) {
    setAddMode('backup');
    setNewKey(emptyNewKey(providerId));
    setReplacingKeyId(null);
    addSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function startReplace(key: ProviderKey) {
    setReplacingKeyId(key.id);
    setReplaceForm({
      apiKey: '',
      label: key.label,
      customBaseUrl: key.customBaseUrl ?? '',
    });
    setAddMode('new');
  }

  function cancelReplace() {
    setReplacingKeyId(null);
    setReplaceForm({ apiKey: '', label: '', customBaseUrl: '' });
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
      resetAddForm();
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

  async function replaceKey(e: React.FormEvent) {
    e.preventDefault();
    if (!replacingKeyId) return;
    setBanner(null);

    const key = keys.find((k) => k.id === replacingKeyId);
    if (!key) return;

    try {
      await apiFetch(
        `/api/keys/${replacingKeyId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            apiKey: replaceForm.apiKey,
            label: replaceForm.label,
            ...(key.providerId === 'openai-compat'
              ? { customBaseUrl: replaceForm.customBaseUrl.trim() || null }
              : {}),
          }),
        },
        fetchOpts,
      );
      const res = await apiFetch<{ keys: ProviderKey[] }>('/api/keys', undefined, fetchOpts);
      setKeys(res.keys);
      cancelReplace();
      showBanner('success', copy.success.keyReplaced);
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
    if (replacingKeyId === id) cancelReplace();
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
    setHealthSummary(null);
    setKeyFeedback({});
    try {
      const res = await apiFetch<{ keys: ProviderKey[] }>(
        '/api/keys/health-check',
        { method: 'POST' },
        fetchOpts,
      );
      setKeys(res.keys);
      const summary = formatHealthSummary(res.keys);
      setHealthSummary(summary);
      const rowFeedback: Record<string, KeyFeedback> = {};
      for (const k of res.keys) {
        const variant: Banner['variant'] =
          k.healthStatus === 'healthy'
            ? 'success'
            : k.healthStatus === 'rate_limited'
              ? 'warn'
              : 'error';
        rowFeedback[k.id] = {
          variant,
          text: healthRowMessage(k.label, k.healthStatus),
        };
      }
      setKeyFeedback(rowFeedback);
      showBanner('success', copy.success.healthCheck);
      keysSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
      const message = err instanceof ApiError ? mapApiError(err.message) : copy.errors.healthCheck;
      setHealthSummary(message);
      showBanner('error', message);
      keysSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } finally {
      setProbing(false);
    }
  }

  async function testKey(key: ProviderKey) {
    setTestingKeyId(key.id);
    setBanner(null);
    try {
      const res = await apiFetch<{
        ok: boolean;
        healthStatus: string;
        message: string;
        key: ProviderKey | null;
      }>(`/api/keys/${key.id}/test`, { method: 'POST' }, fetchOpts);

      if (res.key) {
        setKeys((prev) => prev.map((k) => (k.id === res.key!.id ? res.key! : k)));
      }

      const variant: Banner['variant'] = res.ok
        ? 'success'
        : res.healthStatus === 'rate_limited'
          ? 'warn'
          : 'error';
      const text = res.ok
        ? copy.success.keyTest(key.label)
        : healthRowMessage(key.label, res.healthStatus, res.message);

      setKeyFeedback((prev) => ({ ...prev, [key.id]: { variant, text } }));
      showBanner(variant, text);
      keysSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
      const message =
        err instanceof ApiError ? mapApiError(err.message) : copy.errors.keyTest;
      setKeyFeedback((prev) => ({
        ...prev,
        [key.id]: { variant: 'error', text: `${key.label}: ${message}` },
      }));
      showBanner('error', `${key.label}: ${message}`);
      keysSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } finally {
      setTestingKeyId(null);
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

  const addProviderList =
    addMode === 'backup'
      ? providers.filter((p) => p.id === newKey.providerId)
      : providersWithoutKey;

  const selectedProvider =
    addProviderList.find((p) => p.id === newKey.providerId) ??
    providers.find((p) => p.id === newKey.providerId) ??
    providers[0];

  const backupProviderName =
    providers.find((p) => p.id === newKey.providerId)?.name ?? newKey.providerId;

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

        <section ref={addSectionRef} className="precious-card p-6">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <h2 className="font-display text-lg text-precious-text">
              {addMode === 'backup'
                ? `${copy.keys.backupTitle} — ${backupProviderName}`
                : 'Add provider key'}
            </h2>
            {addMode === 'backup' && (
              <button
                type="button"
                onClick={resetAddForm}
                className="text-xs text-precious-muted hover:text-precious-gold"
              >
                Cancel backup
              </button>
            )}
          </div>

          {addMode === 'backup' && (
            <p className="text-xs text-precious-muted mb-4 leading-relaxed">
              {copy.keys.backupHint}
            </p>
          )}

          {!showAddForm && (
            <p className="text-sm text-precious-muted leading-relaxed">
              {copy.keys.allProvidersConfigured}
            </p>
          )}

          {showAddForm && (
            <>
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
                  disabled={addMode === 'backup'}
                  onChange={(e) => setNewKey({ ...newKey, providerId: e.target.value })}
                >
                  {addProviderList.map((p) => (
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
                    {newKey.providerId === 'openai-compat' && (
                      <ol className="list-decimal pl-5 space-y-1.5 text-precious-muted text-xs leading-relaxed">
                        {copy.keys.ollamaSteps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <a
                        href={selectedProvider.keySetupUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-precious-gold hover:underline font-display"
                      >
                        {selectedProvider.keySetupLinkLabel ??
                          `Get ${selectedProvider.name} API key →`}
                      </a>
                      <Link
                        href={`/docs#${docsAnchor}`}
                        className="text-precious-muted hover:text-precious-gold hover:underline"
                      >
                        Full setup guide
                      </Link>
                    </div>
                  </div>
                )}

                <input
                  className="precious-input"
                  placeholder={
                    addMode === 'backup'
                      ? 'Label (e.g. Groq backup)'
                      : 'Label (e.g. My Groq key)'
                  }
                  value={newKey.label}
                  onChange={(e) => setNewKey({ ...newKey, label: e.target.value })}
                  required
                />
                <input
                  className="precious-input font-mono"
                  placeholder={
                    selectedProvider?.keyless
                      ? 'API key (optional — anonymous tier)'
                      : newKey.providerId === 'cloudflare'
                        ? 'account_id:api_token'
                        : newKey.providerId === 'openai-compat'
                          ? 'API key (use ollama for local Ollama)'
                          : 'API key'
                  }
                  type="password"
                  value={newKey.apiKey}
                  onChange={(e) => setNewKey({ ...newKey, apiKey: e.target.value })}
                  required={!selectedProvider?.keyless}
                />
                {newKey.providerId === 'openai-compat' && (
                  <>
                    <p className="text-[11px] text-precious-muted -mt-1">{copy.keys.ollamaApiKeyHint}</p>
                    <input
                      className="precious-input font-mono"
                      placeholder="Base URL — http://localhost:11434/v1"
                      value={newKey.customBaseUrl}
                      onChange={(e) => setNewKey({ ...newKey, customBaseUrl: e.target.value })}
                    />
                    <p className="text-[11px] text-precious-muted -mt-1">{copy.keys.ollamaBaseUrlHint}</p>
                  </>
                )}
                <button type="submit" className="precious-btn-primary">
                  {addMode === 'backup' ? 'Add backup key' : 'Add key'}
                </button>
                {!canSubmitKey && (
                  <p className="text-xs text-amber-200/90 font-display">
                    Check the Terms box above to unlock the vault.
                  </p>
                )}
              </form>
            </>
          )}
        </section>

        <section ref={keysSectionRef} className="precious-card p-6 scroll-mt-4">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h2 className="font-display text-lg text-precious-text">Your keys</h2>
            {keys.length > 0 && (
              <button
                type="button"
                onClick={runHealthCheck}
                disabled={probing}
                className="text-sm text-precious-gold hover:underline disabled:opacity-50"
              >
                {probing ? 'Testing all keys…' : 'Run health check'}
              </button>
            )}
          </div>
          {probing && (
            <p className="text-xs text-precious-gold/90 mb-3 animate-pulse" role="status">
              Sending a tiny test request to each provider — this can take a few seconds…
            </p>
          )}
          {healthSummary && !probing && (
            <p
              className="text-xs text-precious-muted mb-3 leading-relaxed border border-emerald-900/40 rounded-lg px-3 py-2 bg-precious-bg/40"
              role="status"
            >
              {healthSummary}
            </p>
          )}
          {keys.length > 0 && (
            <p className="text-xs text-precious-muted mb-4 leading-relaxed">
              {copy.keys.backupHint} Use the{' '}
              <span className="text-precious-gold/80" title="Test key with a small request">
                ✓
              </span>{' '}
              icon to test one key.
            </p>
          )}
          {keys.length === 0 ? (
            <p className="text-precious-muted text-sm font-display italic">
              No keys yet. The vault is empty — add one above.
            </p>
          ) : (
            <ul className="space-y-3">
              {keys.map((k) => (
                <li key={k.id} className="border-b border-emerald-900/30 pb-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <HealthDot status={k.healthStatus} />
                      <div className="min-w-0">
                        <span className="text-precious-text">{k.label}</span>
                        <span className="text-precious-muted text-sm ml-2">{k.providerId}</span>
                        {k.meta && <RiskBadge level={k.meta.riskLevel} />}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-sm">
                      <button
                        type="button"
                        onClick={() => testKey(k)}
                        disabled={testingKeyId === k.id || probing}
                        className="inline-flex items-center gap-1 text-precious-muted hover:text-precious-gold disabled:opacity-50 p-0.5 rounded"
                        title="Test key with a small request"
                        aria-label={`Test ${k.label}`}
                      >
                        {testingKeyId === k.id ? (
                          <svg
                            className="w-4 h-4 animate-spin"
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="3"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-4 h-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                          >
                            <path d="M9 12l2 2 4-4" />
                            <circle cx="12" cy="12" r="10" />
                          </svg>
                        )}
                        {testingKeyId === k.id && (
                          <span className="text-[10px] text-precious-gold/80">Testing…</span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => startReplace(k)}
                        className="text-precious-gold hover:underline"
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={() => startBackup(k.providerId)}
                        className="text-precious-muted hover:text-precious-gold hover:underline"
                      >
                        Add backup
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteKey(k.id)}
                        className="text-red-400 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  {keyFeedback[k.id] && (
                    <p
                      className={`text-xs mt-2 pl-5 leading-relaxed ${feedbackTextClass(keyFeedback[k.id].variant)}`}
                      role="status"
                    >
                      {keyFeedback[k.id].text}
                    </p>
                  )}
                  {replacingKeyId === k.id && (
                    <form onSubmit={replaceKey} className="mt-3 space-y-2 pl-6 border-l border-emerald-900/40">
                      <input
                        className="precious-input"
                        placeholder="Label"
                        value={replaceForm.label}
                        onChange={(e) =>
                          setReplaceForm({ ...replaceForm, label: e.target.value })
                        }
                      />
                      <input
                        className="precious-input font-mono"
                        placeholder="New API key"
                        type="password"
                        value={replaceForm.apiKey}
                        onChange={(e) =>
                          setReplaceForm({ ...replaceForm, apiKey: e.target.value })
                        }
                        required
                      />
                      {k.providerId === 'openai-compat' && (
                        <input
                          className="precious-input"
                          placeholder="Base URL"
                          value={replaceForm.customBaseUrl}
                          onChange={(e) =>
                            setReplaceForm({ ...replaceForm, customBaseUrl: e.target.value })
                          }
                        />
                      )}
                      <div className="flex gap-2">
                        <button type="submit" className="precious-btn-primary text-sm py-1.5 px-3">
                          Save new key
                        </button>
                        <button
                          type="button"
                          onClick={cancelReplace}
                          className="text-sm text-precious-muted hover:text-precious-text"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
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
