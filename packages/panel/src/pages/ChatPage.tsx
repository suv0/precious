'use client';

import { useChat, type Message } from 'ai/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PanelLayout } from '../components/PanelLayout';
import { ChatMessageBubble } from '../components/ChatMessageBubble';
import { ChatTypingIndicator } from '../components/ChatTypingIndicator';
import { usePanelConfig } from '../config';
import { apiFetch, AUTO_MODEL } from '../lib/api';
import { copy, failoverToast as formatFailoverToast } from '../lib/copy';
import type { ChatResponseMeta } from '../lib/parse-chat-content';
import { QuestBanner } from '../components/QuestBanner';
import { ChatErrorBanner } from '../components/ChatErrorBanner';
import { QuotaCapacityBar } from '../components/QuotaCapacityBar';
import { useQuotaUsage } from '../hooks/useQuotaUsage';

function metaFromHeaders(res: Response): ChatResponseMeta {
  const tokens = res.headers.get('X-Precious-Tokens');
  return {
    provider: res.headers.get('X-Precious-Provider'),
    model: res.headers.get('X-Precious-Model'),
    tokens: tokens ? Number(tokens) : null,
  };
}

function toUiMessages(
  rows: Array<{ role: string; content: string | null }>,
): Message[] {
  return rows.map((row, i) => ({
    id: `history-${i}`,
    role: row.role as Message['role'],
    content: row.content ?? '',
  }));
}

function ChatPanelInner({
  apiBase,
  chatId,
  initialMessages,
  models,
  selectedModel,
  onSelectedModelChange,
  onNewChat,
  onChatComplete,
  quotaRefreshKey = 0,
}: {
  apiBase?: string;
  chatId: string;
  initialMessages: Message[];
  models: Array<{ id: string; owned_by: string }>;
  selectedModel: string;
  onSelectedModelChange: (model: string) => void;
  onNewChat: () => void;
  onChatComplete?: () => void;
  quotaRefreshKey?: number;
}) {
  const { summary: quotaSummary } = useQuotaUsage(apiBase, quotaRefreshKey);
  const [failoverToast, setFailoverToast] = useState<string | null>(null);
  const [messageMeta, setMessageMeta] = useState<Record<string, ChatResponseMeta>>({});
  const [streamingMeta, setStreamingMeta] = useState<ChatResponseMeta | null>(null);
  const pendingMetaRef = useRef<ChatResponseMeta | null>(null);

  const chatApi = apiBase ? `${apiBase}/api/chat/completions` : '/api/chat/completions';

  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    id: chatId,
    api: chatApi,
    initialMessages,
    streamProtocol: 'text',
    body: { model: selectedModel || AUTO_MODEL, stream: true },
    onResponse: (res) => {
      const meta = metaFromHeaders(res);
      if (meta.provider || meta.model || meta.tokens) {
        pendingMetaRef.current = meta;
        setStreamingMeta(meta);
      }
      const failoverFrom = res.headers.get('X-Failover-From');
      const provider = res.headers.get('X-Precious-Provider');
      if (failoverFrom && provider) {
        setFailoverToast(formatFailoverToast(failoverFrom, provider));
        setTimeout(() => setFailoverToast(null), 8000);
      }
    },
    onFinish: (message) => {
      const meta = pendingMetaRef.current;
      if (meta && (meta.provider || meta.model || meta.tokens)) {
        setMessageMeta((prev) => ({ ...prev, [message.id]: meta }));
      }
      pendingMetaRef.current = null;
      setStreamingMeta(null);
      onChatComplete?.();
    },
  });

  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;

  const metaForMessage = (m: (typeof messages)[number]): ChatResponseMeta | undefined => {
    if (m.role !== 'assistant') return undefined;
    if (messageMeta[m.id]) return messageMeta[m.id];
    if (m.id === lastAssistantId && streamingMeta) return streamingMeta;
    return undefined;
  };

  return (
    <>
      {failoverToast && <QuestBanner variant="warn">{failoverToast}</QuestBanner>}

      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h1 className="font-display text-2xl text-precious-gold">Chat</h1>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            type="button"
            onClick={onNewChat}
            className="text-xs text-precious-muted hover:text-precious-gold border border-emerald-900/50 rounded-full px-3 py-1.5 transition-colors"
          >
            New chat
          </button>
          <select
            className="precious-input py-1.5 text-sm w-auto min-w-[10rem]"
            value={selectedModel}
            onChange={(e) => onSelectedModelChange(e.target.value)}
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id === AUTO_MODEL ? 'Auto (best available)' : m.id}
              </option>
            ))}
          </select>
        </div>
      </div>

      <QuotaCapacityBar summary={quotaSummary} compact />

      <div className="flex-1 overflow-y-auto space-y-5 mb-4 precious-card p-4 scroll-smooth">
        {messages.length === 0 && !isLoading && (
          <p className="text-center text-precious-muted italic py-20 font-display">
            My precious tokens.
          </p>
        )}
        {messages.map((m) => (
          <ChatMessageBubble
            key={m.id}
            role={m.role}
            content={m.content}
            meta={metaForMessage(m)}
          />
        ))}
        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <ChatTypingIndicator />
        )}
        {error && <ChatErrorBanner message={error.message} />}
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
    </>
  );
}

export function ChatPage() {
  const { apiBase, requireAuth, onAuthRequired } = usePanelConfig();
  const [models, setModels] = useState<Array<{ id: string; owned_by: string }>>([]);
  const [selectedModel, setSelectedModel] = useState(AUTO_MODEL);
  const [chatId, setChatId] = useState('precious-local');
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [historyReady, setHistoryReady] = useState(false);
  const [quotaRefreshKey, setQuotaRefreshKey] = useState(0);

  const loadHistory = useCallback(async () => {
    try {
      const res = await apiFetch<{ messages: Array<{ role: string; content: string | null }> }>(
        '/api/chat/messages',
        undefined,
        { apiBase },
      );
      setInitialMessages(toUiMessages(res.messages));
    } catch {
      setInitialMessages([]);
    } finally {
      setHistoryReady(true);
    }
  }, [apiBase]);

  useEffect(() => {
    loadHistory();
    apiFetch<{ data: Array<{ id: string; owned_by: string }> }>(
      '/api/chat/models',
      undefined,
      { apiBase },
    )
      .then((r) => {
        setModels(r.data);
        if (r.data.some((m) => m.id === AUTO_MODEL)) {
          setSelectedModel(AUTO_MODEL);
        } else if (r.data[0]) {
          setSelectedModel(r.data[0].id);
        }
      })
      .catch(() => {
        if (requireAuth && onAuthRequired) onAuthRequired();
      });
  }, [apiBase, requireAuth, onAuthRequired, loadHistory]);

  const handleNewChat = async () => {
    try {
      await apiFetch('/api/chat/messages', { method: 'DELETE' }, { apiBase });
    } catch {
      /* still reset UI */
    }
    setInitialMessages([]);
    setChatId(`precious-local-${Date.now()}`);
  };

  const hasRoutableModels = models.some((m) => m.id !== AUTO_MODEL);

  return (
    <PanelLayout>
      <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-120px)] px-4 py-6">
        {!hasRoutableModels && models.length > 0 && historyReady && (
          <QuestBanner variant="warn">{copy.warn.chatNoKeys}</QuestBanner>
        )}

        {!historyReady ? (
          <p className="text-precious-muted text-sm animate-pulse py-20 text-center font-display">
            Loading conversation…
          </p>
        ) : (
          <ChatPanelInner
            key={chatId}
            chatId={chatId}
            apiBase={apiBase}
            initialMessages={initialMessages}
            models={models}
            selectedModel={selectedModel}
            onSelectedModelChange={setSelectedModel}
            onNewChat={handleNewChat}
            onChatComplete={() => setQuotaRefreshKey((k) => k + 1)}
            quotaRefreshKey={quotaRefreshKey}
          />
        )}
      </div>
    </PanelLayout>
  );
}
