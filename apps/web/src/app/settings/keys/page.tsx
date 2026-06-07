'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageLayout } from '@/components/PageLayout';
import { RiskBadge } from '@/components/RiskBadge';
import { apiFetch, type ProviderKey, type FallbackEntry, type ProviderMeta } from '@/lib/api';
import { isLocalMode } from '@/lib/mode';

export default function KeysSettingsPage() {
  const router = useRouter();
  const [keys, setKeys] = useState<ProviderKey[]>([]);
  const [providers, setProviders] = useState<ProviderMeta[]>([]);
  const [chain, setChain] = useState<FallbackEntry[]>([]);
  const [tosAck, setTosAck] = useState(false);
  const [needsTos, setNeedsTos] = useState(true);
  const [newKey, setNewKey] = useState({ providerId: 'groq', label: '', apiKey: '', customBaseUrl: '' });
  const [unifiedKey, setUnifiedKey] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    Promise.all([
      apiFetch<{ keys: ProviderKey[] }>('/api/keys'),
      apiFetch<{ providers: ProviderMeta[] }>('/api/keys/providers'),
      apiFetch<{ chain: FallbackEntry[] }>('/api/fallback-chain'),
      apiFetch<{ tosAcknowledged: boolean }>('/api/keys/settings'),
    ])
      .then(([k, p, c, s]) => {
        setKeys(k.keys);
        setProviders(p.providers);
        setChain(c.chain);
        setNeedsTos(!s.tosAcknowledged);
        setTosAck(s.tosAcknowledged);
      })
      .catch(() => {
        if (!isLocalMode()) router.push('/login');
      });
  }, [router]);

  async function addKey(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    try {
      await apiFetch('/api/keys', {
        method: 'POST',
        body: JSON.stringify({
          ...newKey,
          tosAcknowledged: needsTos ? tosAck : undefined,
        }),
      });
      setNewKey({ providerId: 'groq', label: '', apiKey: '', customBaseUrl: '' });
      setNeedsTos(false);
      const k = await apiFetch<{ keys: ProviderKey[] }>('/api/keys');
      setKeys(k.keys);
      setMessage('Key added. Keeping it safe, yesss.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function deleteKey(id: string) {
    await apiFetch(`/api/keys/${id}`, { method: 'DELETE' });
    setKeys((prev) => prev.filter((k) => k.id !== id));
  }

  async function generateUnified() {
    const res = await apiFetch<{ key: string; message: string }>('/api/keys/unified', {
      method: 'POST',
    });
    setUnifiedKey(res.key);
  }

  async function saveChain() {
    await apiFetch('/api/fallback-chain', {
      method: 'PUT',
      body: JSON.stringify({ chain }),
    });
    setMessage('Fallback chain saved.');
  }

  function moveChain(idx: number, dir: -1 | 1) {
    const next = [...chain];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setChain(next.map((e, i) => ({ ...e, priority: i })));
  }

  return (
    <PageLayout>
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">
        <div>
          <h1 className="font-display text-3xl text-precious-gold">Keys & routing</h1>
          <p className="text-precious-muted text-sm mt-1">
            <Link href="/legal" className="text-precious-gold hover:underline">Read Legal / ToS</Link> before adding keys.
          </p>
        </div>

        {message && <p className="text-emerald-300 text-sm">{message}</p>}

        <section className="precious-card p-6">
          <h2 className="font-display text-lg text-precious-text mb-4">Unified API key</h2>
          <p className="text-sm text-precious-muted mb-4">
            Prefix <code className="text-precious-gold">prec_</code> — use in Cursor, Python, LangChain.
          </p>
          {unifiedKey ? (
            <div className="bg-precious-bg rounded-lg p-4 font-mono text-sm text-precious-gold break-all">
              {unifiedKey}
              <p className="text-red-300 text-xs mt-2">Copy now — shown once only.</p>
            </div>
          ) : (
            <button onClick={generateUnified} className="precious-btn-gold">
              Generate prec_ key
            </button>
          )}
        </section>

        <section className="precious-card p-6">
          <h2 className="font-display text-lg text-precious-text mb-4">Add provider key</h2>
          {needsTos && (
            <label className="flex items-start gap-3 mb-4 text-sm text-precious-muted">
              <input type="checkbox" checked={tosAck} onChange={(e) => setTosAck(e.target.checked)} className="mt-1" />
              <span>
                I own these API keys and accept each provider&apos;s Terms of Service. I have read{' '}
                <Link href="/security" className="text-precious-gold">Security</Link>,{' '}
                <Link href="/privacy" className="text-precious-gold">Privacy</Link>, and{' '}
                <Link href="/legal" className="text-precious-gold">Legal</Link>.
              </span>
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
            <button type="submit" className="precious-btn-primary" disabled={needsTos && !tosAck}>
              Add key
            </button>
          </form>
        </section>

        <section className="precious-card p-6">
          <h2 className="font-display text-lg text-precious-text mb-4">Your keys</h2>
          {keys.length === 0 ? (
            <p className="text-precious-muted text-sm">No keys yet. Add one above.</p>
          ) : (
            <ul className="space-y-3">
              {keys.map((k) => (
                <li key={k.id} className="flex items-center justify-between gap-4 border-b border-emerald-900/30 pb-3">
                  <div>
                    <span className="text-precious-text">{k.label}</span>
                    <span className="text-precious-muted text-sm ml-2">{k.providerId}</span>
                    {k.meta && <RiskBadge level={k.meta.riskLevel} />}
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
                  <span className="text-precious-text flex-1">{e.providerId} / {e.model}</span>
                  <button onClick={() => moveChain(i, -1)} className="text-precious-gold">↑</button>
                  <button onClick={() => moveChain(i, 1)} className="text-precious-gold">↓</button>
                </li>
              ))}
            </ul>
            <button onClick={saveChain} className="precious-btn-gold mt-4">
              Save order
            </button>
          </section>
        )}
      </div>
    </PageLayout>
  );
}
