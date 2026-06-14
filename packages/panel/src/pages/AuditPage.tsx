'use client';

import { useEffect, useState } from 'react';
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

function actionLabel(action: string, meta: Record<string, unknown> | null): string {
  if (action === 'chat_request') {
    const provider = meta?.provider as string | undefined;
    const model = meta?.model as string | undefined;
    const error = meta?.error as string | undefined;
    if (error) return `Chat failed — ${error.slice(0, 60)}`;
    if (provider && model) return `${provider} · ${model}`;
    return 'Chat request';
  }
  if (action === 'key_created') return `Key created — ${(meta?.providerId as string) ?? 'unknown'}`;
  if (action === 'key_updated') return 'Key replaced';
  if (action === 'key_deleted') return 'Key removed';
  if (action === 'unified_key_created') return 'Unified key generated';
  if (action === 'login') return 'Login';
  return action;
}

function routeDetail(meta: Record<string, unknown> | null): string {
  if (!meta) return '';
  const failoverFrom = meta.failoverFrom as string | undefined;
  const attempts = meta.attempts as number | undefined;
  const tokens = meta.tokens as number | undefined;
  const parts: string[] = [];
  if (failoverFrom) parts.push(`failover from ${failoverFrom}`);
  if (attempts && attempts > 1) parts.push(`${attempts} attempts`);
  if (tokens) parts.push(`${tokens.toLocaleString()} tokens`);
  return parts.join(' · ');
}

export function AuditPage() {
  const { apiBase, requireAuth, onAuthRequired } = usePanelConfig();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ entries: AuditLogEntry[] }>('/api/keys/audit', undefined, { apiBase })
      .then((res) => {
        setEntries(res.entries);
        setLoading(false);
      })
      .catch((err) => {
        if (requireAuth && onAuthRequired) onAuthRequired();
        setError(err instanceof Error ? err.message : 'Failed to load audit log');
        setLoading(false);
      });
  }, [apiBase, requireAuth, onAuthRequired]);

  const routeEntries = entries.filter((e) => ROUTE_ACTIONS.has(e.action));
  const shown = routeEntries.length > 0 ? routeEntries : entries.slice(0, 100);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="font-display text-3xl text-precious-gold">Audit trail</h1>
          <p className="text-precious-muted text-sm mt-1">
            Every chat request — which provider won, failovers, tokens, errors.
          </p>
        </div>

        {loading && (
          <p className="text-precious-muted text-sm animate-pulse py-20 text-center font-display">
            Loading audit log…
          </p>
        )}

        {error && (
          <p className="text-red-300 text-sm">{error}</p>
        )}

        {!loading && shown.length === 0 && (
          <p className="text-precious-muted text-sm font-display italic py-20 text-center">
            No chat requests yet. Send a message and check back.
          </p>
        )}

        {shown.length > 0 && (
          <div className="precious-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-emerald-900/40 text-left text-precious-muted text-xs">
                    <th className="py-3 px-4 font-medium">Time</th>
                    <th className="py-3 px-4 font-medium">Route</th>
                    <th className="py-3 px-4 font-medium hidden sm:table-cell">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-900/20">
                  {shown.map((entry) => {
                    const isError = !!entry.metadata?.error;
                    return (
                      <tr
                        key={entry.id}
                        className={`hover:bg-emerald-950/30 transition-colors ${isError ? 'bg-red-950/20' : ''}`}
                      >
                        <td className="py-2.5 px-4 font-mono text-precious-muted text-xs whitespace-nowrap">
                          <span className="text-precious-text/60">{formatDate(entry.createdAt)}</span>{' '}
                          {formatTime(entry.createdAt)}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className={isError ? 'text-red-300/90' : 'text-precious-text'}>
                            {actionLabel(entry.action, entry.metadata)}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-precious-muted/80 text-xs hidden sm:table-cell max-w-xs truncate">
                          {routeDetail(entry.metadata)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
  );
}
