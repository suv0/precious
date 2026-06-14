'use client';

import { useChat, type Message } from 'ai/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanelLayout } from '../components/PanelLayout';
import { ChatMessageBubble } from '../components/ChatMessageBubble';
import { ChatComposer } from '../components/ChatComposer';
import { ChatTypingIndicator } from '../components/ChatTypingIndicator';
import { usePanelConfig } from '../config';
import { apiFetch, AUTO_MODEL } from '../lib/api';
import { copy, failoverToast as formatFailoverToast } from '../lib/copy';
import type { ChatResponseMeta } from '../lib/parse-chat-content';
import {
  attachmentCapabilitiesForModel,
  dedupeModelOptions,
  formatModelOptionLabel,
  modelSelectValue,
  type ChatModelOption,
} from '../lib/chat-models';
import { prepareChatRequestBody } from '../lib/prepare-chat-body';
import { QuestBanner } from '../components/QuestBanner';
import { ChatErrorBanner } from '../components/ChatErrorBanner';
import { QuotaCapacityBar } from '../components/QuotaCapacityBar';
import { useQuotaUsage } from '../hooks/useQuotaUsage';

function metaFromHeaders(res: Response): ChatResponseMeta {
  const tokens = res.headers.get('X-Precious-Tokens');
  const trailRaw = res.headers.get('X-Precious-Trail');
  let trail = null;
  if (trailRaw) {
    try { trail = JSON.parse(trailRaw); } catch { /* ignore */ }
  }
  return {
    provider: res.headers.get('X-Precious-Provider'),
    model: res.headers.get('X-Precious-Model'),
    tokens: tokens ? Number(tokens) : null,
    trail,
  };
}

function toUiMessages(
  rows: Array<{ role: string; content: string | null }>,
): Message[] {
  return rows.map((row, i) => ({
    id: `history-${i}`,
    role: row.role as Message['role'],
    content: typeof row.content === 'string' ? row.content : '',
  }));
}

function filesToFileList(files: File[]): FileList {
  const dt = new DataTransfer();
  for (const f of files) dt.items.add(f);
  return dt.files;
}

function ChatPanelInner({
  apiBase,
  chatId,
  initialMessages,
  initialMeta,
  models,
  selectedModel,
  onSelectedModelChange,
  onNewChat,
  onChatComplete,
  onRefreshModels,
  quotaRefreshKey = 0,
}: {
  apiBase?: string;
  chatId: string;
  initialMessages: Message[];
  initialMeta: Record<string, ChatResponseMeta>;
  models: ChatModelOption[];
  selectedModel: string;
  onSelectedModelChange: (model: string) => void;
  onNewChat: () => void;
  onChatComplete?: () => void;
  onRefreshModels?: () => void;
  quotaRefreshKey?: number;
}) {
  const { summary: quotaSummary } = useQuotaUsage(apiBase, quotaRefreshKey);
  const [failoverToast, setFailoverToast] = useState<string | null>(null);
  const [messageMeta, setMessageMeta] = useState<Record<string, ChatResponseMeta>>(initialMeta);
  const [streamingMeta, setStreamingMeta] = useState<ChatResponseMeta | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const pendingMetaRef = useRef<ChatResponseMeta | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const modelOptions = useMemo(() => dedupeModelOptions(models), [models]);
  const attachmentCaps = useMemo(
    () => attachmentCapabilitiesForModel(selectedModel, modelOptions),
    [selectedModel, modelOptions],
  );
  const attachmentsEnabled = attachmentCaps.any;
  const attachmentsHint = attachmentsEnabled
    ? undefined
    : `Text-only — pick a 📎 model for images/files`;

  const chatApi = apiBase ? `${apiBase}/api/chat/completions` : '/api/chat/completions';

  const { messages, input, handleInputChange, handleSubmit, isLoading, error, reload } = useChat({
    id: chatId,
    api: chatApi,
    initialMessages,
    streamProtocol: 'text',
    sendExtraMessageFields: true,
    experimental_prepareRequestBody: ({ messages: chatMessages }) =>
      prepareChatRequestBody({
        messages: chatMessages,
        selectedModel,
        models: modelOptions,
      }),
    onResponse: (res) => {
      if (!res.ok) {
        setChatError(`Request failed (${res.status}). See error below or try Keys → test your OpenRouter key.`);
      }
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
    onError: (err) => {
      setChatError(err.message || 'Could not get a reply');
    },
    onFinish: (message) => {
      if (!message.content?.trim()) {
        setChatError('The provider returned an empty reply. Try Retry or another model.');
      } else {
        setChatError(null);
      }
      const meta = pendingMetaRef.current;
      if (meta && (meta.provider || meta.model || meta.tokens)) {
        setMessageMeta((prev) => ({ ...prev, [message.id]: meta }));
      }
      pendingMetaRef.current = null;
      setStreamingMeta(null);
      onChatComplete?.();
      onRefreshModels?.();
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading]);

  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;

  const metaForMessage = (m: (typeof messages)[number]): ChatResponseMeta | undefined => {
    if (m.role !== 'assistant') return undefined;
    if (messageMeta[m.id]) return messageMeta[m.id];
    if (m.id === lastAssistantId && streamingMeta) return streamingMeta;
    return undefined;
  };

  const lastMessage = messages[messages.length - 1];
  const awaitingReply = !isLoading && lastMessage?.role === 'user';
  const errorMessage = chatError ?? error?.message ?? null;

  const onComposerSubmit = (files: File[]) => {
    setChatError(null);
    const fileList = files.length > 0 ? filesToFileList(files) : undefined;
    handleSubmit(undefined, {
      experimental_attachments: fileList,
      allowEmptySubmit: files.length > 0,
    });
  };

  const composerPlaceholder = attachmentsEnabled
    ? attachmentCaps.images && attachmentCaps.documents
      ? 'Ask anything… attach images or files with 📎'
      : attachmentCaps.images
        ? 'Ask anything… attach images with 📎 or Ctrl+V'
        : 'Ask anything… attach CSV, PDF, or text files with 📎'
    : 'Ask anything…';

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
            className="precious-input py-1.5 text-sm w-auto min-w-[12rem]"
            value={selectedModel}
            onChange={(e) => onSelectedModelChange(e.target.value)}
            style={{ color: '#e8f0ec' }}
          >
            {modelOptions.map((m) => (
              <option
                key={modelSelectValue(m)}
                value={modelSelectValue(m)}
                style={{ background: '#0a1612', color: '#e8f0ec' }}
              >
                {formatModelOptionLabel(m)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <QuotaCapacityBar summary={quotaSummary} compact />

      <div className="flex-1 min-h-0 overflow-y-auto space-y-5 mb-4 precious-card p-4 scroll-smooth">
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
            attachments={m.experimental_attachments}
          />
        ))}
        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <ChatTypingIndicator />
        )}
        {awaitingReply && !errorMessage && (
          <div className="flex items-center gap-3 text-sm">
            <p className="text-precious-muted text-xs">No reply yet.</p>
            <button
              type="button"
              onClick={() => {
                setChatError(null);
                reload();
              }}
              className="text-precious-gold hover:underline text-xs font-display"
            >
              Retry
            </button>
          </div>
        )}
        {errorMessage && (
          <div className="space-y-2">
            <ChatErrorBanner message={errorMessage} />
            <button
              type="button"
              onClick={() => {
                setChatError(null);
                reload();
              }}
              disabled={isLoading}
              className="text-sm text-precious-gold hover:underline disabled:opacity-50 font-display"
            >
              Retry last message
            </button>
          </div>
        )}
        <div ref={bottomRef} className="h-px shrink-0" aria-hidden />
      </div>

      <ChatComposer
        input={input}
        onInputChange={handleInputChange}
        onSubmit={onComposerSubmit}
        isLoading={isLoading}
        attachmentCapabilities={{
          images: attachmentCaps.images,
          documents: attachmentCaps.documents,
        }}
        attachmentsHint={attachmentsHint}
        placeholder={composerPlaceholder}
      />
    </>
  );
}

export function ChatPage() {
  const { apiBase, requireAuth, onAuthRequired } = usePanelConfig();
  const [models, setModels] = useState<ChatModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState(AUTO_MODEL);
  const [chatId, setChatId] = useState('precious-local');
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [historyMeta, setHistoryMeta] = useState<Record<string, ChatResponseMeta>>({});
  const [historyReady, setHistoryReady] = useState(false);
  const [quotaRefreshKey, setQuotaRefreshKey] = useState(0);

  const loadModels = useCallback(async () => {
    try {
      const r = await apiFetch<{ data: ChatModelOption[] }>(
        '/api/chat/models',
        undefined,
        { apiBase },
      );
      setModels(r.data);
    } catch {
      setModels([{ id: AUTO_MODEL, owned_by: 'precious' }]);
      if (requireAuth && onAuthRequired) onAuthRequired();
    }
  }, [apiBase, requireAuth, onAuthRequired]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await apiFetch<{
        messages: Array<{ role: string; content: string | null }>;
        metaMap?: Record<string, Record<string, unknown>>;
      }>(
        '/api/chat/messages',
        undefined,
        { apiBase },
      );
      setInitialMessages(toUiMessages(res.messages));
      if (res.metaMap) {
        const restoredMeta: Record<string, ChatResponseMeta> = {};
        for (const [idx, meta] of Object.entries(res.metaMap)) {
          const id = `history-${idx}`;
          restoredMeta[id] = {
            provider: meta.provider as string | undefined,
            model: meta.model as string | undefined,
            tokens: meta.tokens as number | undefined,
            trail: meta.trail as ChatResponseMeta['trail'],
          };
        }
        setHistoryMeta(restoredMeta);
      }
    } catch {
      setInitialMessages([]);
    } finally {
      setHistoryReady(true);
    }
  }, [apiBase]);

  useEffect(() => {
    loadHistory();
    loadModels();
  }, [loadHistory, loadModels]);

  const handleNewChat = async () => {
    try {
      await apiFetch('/api/chat/messages', { method: 'DELETE' }, { apiBase });
    } catch {
      /* still reset UI */
    }
    setInitialMessages([]);
    setHistoryMeta({});
    setChatId(`precious-local-${Date.now()}`);
  };

  const hasRoutableModels = models.some((m) => m.id !== AUTO_MODEL);

  return (
    <PanelLayout>
      <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-120px)] px-4 py-6 min-h-0">
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
            initialMeta={historyMeta}
            models={models}
            selectedModel={selectedModel}
            onSelectedModelChange={setSelectedModel}
            onNewChat={handleNewChat}
            onChatComplete={() => setQuotaRefreshKey((k) => k + 1)}
            onRefreshModels={loadModels}
            quotaRefreshKey={quotaRefreshKey}
          />
        )}
      </div>
    </PanelLayout>
  );
}
