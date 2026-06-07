'use client';

import { useChat } from 'ai/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageLayout } from '@/components/PageLayout';
import { apiFetch } from '@/lib/api';
import { isLocalMode } from '@/lib/mode';

export default function ChatPage() {
  const router = useRouter();
  const [models, setModels] = useState<Array<{ id: string; owned_by: string }>>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [routedVia, setRoutedVia] = useState<string | null>(null);
  const [failoverToast, setFailoverToast] = useState<string | null>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: '/api/chat/completions',
    streamProtocol: 'text',
    body: { model: selectedModel || undefined },
    onResponse: (res) => {
      const provider = res.headers.get('X-Precious-Provider');
      const model = res.headers.get('X-Precious-Model');
      const failoverFrom = res.headers.get('X-Failover-From');
      if (provider) setRoutedVia(`${provider} / ${model ?? selectedModel}`);
      if (failoverFrom && provider) {
        const msg = `${failoverFrom} limit reached — continued on ${provider} with your full conversation`;
        setFailoverToast(msg);
        setTimeout(() => setFailoverToast(null), 8000);
      }
    },
  });

  useEffect(() => {
    apiFetch<{ data: Array<{ id: string; owned_by: string }> }>('/api/chat/models')
      .then((r) => {
        setModels(r.data);
        if (r.data[0]) setSelectedModel(r.data[0].id);
      })
      .catch(() => {
        if (!isLocalMode()) router.push('/login');
      });
  }, [router]);

  return (
    <PageLayout>
      <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-180px)] px-4 py-6">
        {failoverToast && (
          <div className="mb-3 text-sm text-amber-200 bg-amber-950/50 border border-amber-800/60 rounded-lg px-4 py-2">
            {failoverToast}
          </div>
        )}

        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <h1 className="font-display text-2xl text-precious-gold">Chat</h1>
          <div className="flex items-center gap-3">
            {routedVia && (
              <span className="text-xs text-precious-muted border border-emerald-800/60 rounded-full px-3 py-1">
                Routed via {routedVia}
              </span>
            )}
            <select
              className="precious-input py-1.5 text-sm w-auto"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 mb-4 precious-card p-4">
          {messages.length === 0 && (
            <p className="text-center text-precious-muted italic py-20 font-display">
              My precious tokens.
            </p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-emerald-800/60 text-precious-text'
                    : 'bg-precious-bg/80 border border-emerald-900/40 text-precious-muted'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <p className="text-precious-muted text-sm animate-pulse">Routing…</p>
          )}
          {error && (
            <p className="text-red-400 text-sm">
              {error.message.includes('401')
                ? 'You shall not pass… without a valid API key. Add keys in Settings.'
                : error.message}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            className="precious-input flex-1"
            value={input}
            onChange={handleInputChange}
            placeholder="Ask anything…"
            disabled={isLoading}
          />
          <button type="submit" className="precious-btn-primary" disabled={isLoading || !input.trim()}>
            Send
          </button>
        </form>
      </div>
    </PageLayout>
  );
}
