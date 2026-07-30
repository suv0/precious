'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePanelConfig } from '../config';
import { apiFetch, type AuditLogEntry } from '../lib/api';

const ROUTE_ACTIONS = new Set(['chat_request']);

function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function isFailed(meta: Record<string, unknown> | null): boolean {
  return !!(meta?.error || meta?.streamFailed);
}

function actionLabel(action: string, meta: Record<string, unknown> | null): string {
  if (action === 'chat_request') {
    const provider = meta?.provider as string | undefined;
    const model = meta?.model as string | undefined;
    const error = meta?.error as string | undefined;
    const streamFailed = meta?.streamFailed as boolean | undefined;
    if (error) return `Failed — ${error.slice(0, 60)}`;
    if (streamFailed) {
      const streamFailedProvider = meta?.streamFailedProvider as string | undefined;
      if (provider && model && streamFailedProvider) {
        return `${streamFailedProvider} ✗ → ${provider} · ${model}`;
      }
      return `Stream retry to ${provider} · ${model}`;
    }
    if (provider && model) return `${provider} · ${model}`;
    return 'Chat request';
  }
  if (action === 'key_created') return `Key sealed — ${(meta?.providerId as string) ?? 'unknown'}`;
  if (action === 'key_updated') return 'Key replaced';
  if (action === 'key_deleted') return 'Key removed';
  if (action === 'unified_key_created') return 'Master key forged';
  if (action === 'login') return 'Login';
  return action;
}

function routeDetail(meta: Record<string, unknown> | null): string {
  if (!meta) return '';
  const failoverFrom = meta.failoverFrom as string | undefined;
  const attempts = meta.attempts as number | undefined;
  const streamError = meta.streamError as string | undefined;
  const parts: string[] = [];
  if (failoverFrom) parts.push(`failover from ${failoverFrom}`);
  if (attempts && attempts > 1) parts.push(`${attempts} attempts`);
  if (streamError) parts.push(`error: ${streamError}`);
  return parts.join(' · ');
}

function tokenCount(meta: Record<string, unknown> | null): number | null {
  const tokens = meta?.tokens;
  return typeof tokens === 'number' && !Number.isNaN(tokens) ? tokens : null;
}

export function AuditPage() {
  const { apiBase, requireAuth, onAuthRequired } = usePanelConfig();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    apiFetch<{ entries: AuditLogEntry[] }>('/api/keys/audit', undefined, { apiBase })
      .then((res) => {
        setEntries(res.entries);
        setLoading(false);
      })
      .catch((err) => {
        if (requireAuth && onAuthRequired) onAuthRequired();
        setError(err instanceof Error ? err.message : 'Failed to load chronicles');
        setLoading(false);
      });
  }, [apiBase, requireAuth, onAuthRequired]);

  const routeEntries = entries.filter((e) => ROUTE_ACTIONS.has(e.action));
  const shownBase = routeEntries.length > 0 ? routeEntries : entries.slice(0, 100);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return shownBase;
    return shownBase.filter((e) => {
      const label = actionLabel(e.action, e.metadata).toLowerCase();
      const detail = routeDetail(e.metadata).toLowerCase();
      return label.includes(q) || detail.includes(q) || e.action.toLowerCase().includes(q);
    });
  }, [shownBase, search]);

  const stats = useMemo(() => {
    const chat = routeEntries.length > 0 ? routeEntries : entries.filter((e) => e.action === 'chat_request');
    const failed = chat.filter((e) => isFailed(e.metadata)).length;
    const success = Math.max(chat.length - failed, 0);
    const reliability = chat.length === 0 ? null : Math.round((success / chat.length) * 1000) / 10;
    const tokenFlux = chat.reduce((sum, e) => sum + (tokenCount(e.metadata) ?? 0), 0);
    const failovers = chat.filter(
      (e) => !!(e.metadata?.failoverFrom || e.metadata?.streamFailed || (typeof e.metadata?.attempts === 'number' && e.metadata.attempts > 1)),
    ).length;
    return { reliability, tokenFlux, failovers, total: chat.length };
  }, [routeEntries, entries]);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(shown, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `precious-chronicles-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-precious-gold/70 mb-1">Chronicles</p>
          <h1 className="font-display text-3xl md:text-4xl text-precious-gold-bright gold-glow tracking-wide">
            Audit Chronicles
          </h1>
          <p className="text-precious-muted text-sm mt-2 max-w-2xl">
            Every whisper and interaction within the Vault, preserved in the ledger of API traffic.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 text-xs text-precious-muted border border-precious-emerald/40 rounded-full px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 vault-pulse" />
            Live ledger
          </span>
          <button type="button" onClick={exportJson} className="precious-btn-gold text-sm py-1.5 px-3" disabled={shown.length === 0}>
            Export archive
          </button>
        </div>
      </div>

      {loading && (
        <p className="text-precious-muted text-sm animate-pulse py-20 text-center font-display">
          Unsealing chronicles…
        </p>
      )}

      {error && <p className="text-red-300 text-sm">{error}</p>}

      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="precious-card p-5">
            <p className="text-[10px] uppercase tracking-[0.16em] text-precious-muted mb-2">Reliability score</p>
            <p className="font-display text-3xl text-precious-gold">
              {stats.reliability == null ? '—' : `${stats.reliability}%`}
            </p>
            <p className="text-xs text-precious-muted mt-1">
              {stats.total === 0 ? 'No chat requests yet' : `${stats.total} transmutations in ledger`}
            </p>
          </div>
          <div className="precious-card p-5">
            <p className="text-[10px] uppercase tracking-[0.16em] text-precious-muted mb-2">Token flux</p>
            <p className="font-display text-3xl text-precious-gold">{stats.tokenFlux.toLocaleString()}</p>
            <p className="text-xs text-precious-muted mt-1">Across recorded chat requests</p>
          </div>
          <div className="precious-card p-5">
            <p className="text-[10px] uppercase tracking-[0.16em] text-precious-muted mb-2">Failover incidents</p>
            <p className="font-display text-3xl text-precious-gold">{stats.failovers}</p>
            <p className="text-xs text-precious-muted mt-1">Retries and provider switches</p>
          </div>
        </div>
      )}

      {!loading && shownBase.length === 0 && (
        <p className="text-precious-muted text-sm font-display italic py-16 text-center">
          No chronicles yet. Whisper in Sanctum and return.
        </p>
      )}

      {shownBase.length > 0 && (
        <div className="precious-card overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-precious-emerald/40">
            <h2 className="font-display text-sm tracking-wide text-precious-gold">Recent transmutations</h2>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search the ledger…"
              className="precious-input py-1.5 text-sm max-w-xs"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-precious-emerald/40 text-left text-precious-muted text-xs uppercase tracking-wider">
                  <th className="py-3 px-4 font-medium">Time</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium">Route &amp; fallback</th>
                  <th className="py-3 px-4 font-medium hidden md:table-cell">Detail</th>
                  <th className="py-3 px-4 font-medium text-right">Tokens</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-precious-emerald/20">
                {shown.map((entry) => {
                  const failed = isFailed(entry.metadata);
                  const tokens = tokenCount(entry.metadata);
                  return (
                    <tr
                      key={entry.id}
                      className={`hover:bg-precious-emerald/20 transition-colors ${failed ? 'bg-red-950/15' : ''}`}
                    >
                      <td className="py-2.5 px-4 font-mono text-precious-muted text-xs whitespace-nowrap">
                        <span className="text-precious-text/60">{formatDate(entry.createdAt)}</span>{' '}
                        {formatTime(entry.createdAt)}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide border ${
                            failed
                              ? 'border-red-700/50 text-red-300 bg-red-950/30'
                              : 'border-emerald-700/50 text-emerald-300 bg-emerald-950/30'
                          }`}
                        >
                          {failed ? 'Terminated' : 'Success'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={failed ? 'text-red-300/90' : 'text-precious-text'}>
                          {actionLabel(entry.action, entry.metadata)}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-precious-muted/80 text-xs hidden md:table-cell max-w-xs truncate">
                        {routeDetail(entry.metadata)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-precious-gold text-xs">
                        {tokens != null ? tokens.toLocaleString() : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-precious-emerald/40 text-xs text-precious-muted">
            Showing {shown.length} of {shownBase.length} chronicles
          </div>
        </div>
      )}
    </div>
  );
}
