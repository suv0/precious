'use client';

import { useChat, type Message } from 'ai/react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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

function ChatMessageList({
  messages,
  isLoading,
  errorMessage,
  awaitingReply,
  messageMeta,
  lastAssistantId,
  streamingMeta,
  chatErrorRef,
  setChatError,
  reload,
}: {
  messages: Message[];
  isLoading: boolean;
  errorMessage: string | null;
  awaitingReply: boolean;
  messageMeta: Record<string, ChatResponseMeta>;
  lastAssistantId: string | undefined;
  streamingMeta: ChatResponseMeta | null;
  chatErrorRef: React.MutableRefObject<string | null>;
  setChatError: (err: string | null) => void;
  reload: () => void;
}) {
  const metaForMessage = useCallback(
    (m: (typeof messages)[number]): ChatResponseMeta | undefined => {
      if (m.role !== 'assistant') return undefined;
      if (messageMeta[m.id]) return messageMeta[m.id];
      if (m.id === lastAssistantId && streamingMeta) return streamingMeta;
      return undefined;
    },
    [messageMeta, lastAssistantId, streamingMeta],
  );

  if (messages.length === 0 && !isLoading) {
    return (
      <p className="text-center text-precious-muted/80 italic py-20 font-display tracking-wide">
        Whisper to the Vault…
      </p>
    );
  }

  return (
    <>
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
              chatErrorRef.current = null;
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
              chatErrorRef.current = null;
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
    </>
  );
}

const MemoizedChatMessageList = memo(ChatMessageList, (prev, next) =>
  prev.messages.length === next.messages.length &&
  prev.messages[prev.messages.length - 1]?.content === next.messages[next.messages.length - 1]?.content &&
  prev.isLoading === next.isLoading &&
  prev.errorMessage === next.errorMessage &&
  prev.awaitingReply === next.awaitingReply &&
  prev.streamingMeta === next.streamingMeta,
);

function ChatPanelInner({
  apiBase,
  chatId,
  conversationId,
  initialMessages,
  initialMeta,
  models,
  selectedModel,
  onSelectedModelChange,
  onChatComplete,
  onRefreshModels,
  onConversationCreated,
  quotaRefreshKey = 0,
}: {
  apiBase?: string;
  chatId: string;
  conversationId: string | null;
  initialMessages: Message[];
  initialMeta: Record<string, ChatResponseMeta>;
  models: ChatModelOption[];
  selectedModel: string;
  onSelectedModelChange: (model: string) => void;
  onChatComplete?: () => void;
  onRefreshModels?: () => void;
  onConversationCreated?: (cid: string) => void;
  quotaRefreshKey?: number;
}) {
  const { summary: quotaSummary } = useQuotaUsage(apiBase, quotaRefreshKey);
  const [failoverToast, setFailoverToast] = useState<string | null>(null);
  const [messageMeta, setMessageMeta] = useState<Record<string, ChatResponseMeta>>(initialMeta);
  const [streamingMeta, setStreamingMeta] = useState<ChatResponseMeta | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [currentConvId, setCurrentConvId] = useState<string | null>(conversationId);
  const pendingMetaRef = useRef<ChatResponseMeta | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatErrorRef = useRef<string | null>(null);

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
    experimental_prepareRequestBody: ({ messages: chatMessages }) => ({
      ...prepareChatRequestBody({
        messages: chatMessages,
        selectedModel,
        models: modelOptions,
      }),
      conversationId: currentConvId,
    }),
    onResponse: (res) => {
      if (!res.ok) {
        const msg = `Request failed (${res.status}). See error below or try Keys → test your OpenRouter key.`;
        chatErrorRef.current = msg;
        setChatError(msg);
      }
      const meta = metaFromHeaders(res);
      if (meta.provider || meta.model || meta.tokens) {
        pendingMetaRef.current = meta;
        setStreamingMeta(meta);
      }
      const failoverFrom = res.headers.get('X-Failover-From');
      const provider = res.headers.get('X-Precious-Provider');

      // Server returns a new conversation ID if one was auto-created
      const serverCid = res.headers.get('X-Precious-Conversation');
      if (serverCid && !currentConvId) {
        setCurrentConvId(serverCid);
        onConversationCreated?.(serverCid);
      }

      if (failoverFrom && provider) {
        setFailoverToast(formatFailoverToast(failoverFrom, provider));
        setTimeout(() => setFailoverToast(null), 8000);
      }
    },
    onError: (err) => {
      if (chatErrorRef.current) return;
      chatErrorRef.current = err.message || 'Could not get a reply';
      setChatError(chatErrorRef.current);
    },
    onFinish: (message) => {
      if (chatErrorRef.current) return;
      if (!message.content?.trim()) {
        chatErrorRef.current = 'The provider returned an empty reply. Try Retry or another model.';
        setChatError(chatErrorRef.current);
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

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;

  const lastMessage = messages[messages.length - 1];
  const awaitingReply = !isLoading && lastMessage?.role === 'user';
  const errorMessage = chatError ?? error?.message ?? null;

  const onComposerSubmit = (files: File[]) => {
    chatErrorRef.current = null;
    setChatError(null);
    const fileList = files.length > 0 ? filesToFileList(files) : undefined;
    handleSubmit(undefined, {
      experimental_attachments: fileList,
      allowEmptySubmit: files.length > 0,
    });
  };

  const composerPlaceholder = attachmentsEnabled
    ? attachmentCaps.images && attachmentCaps.documents
      ? 'Whisper to the Vault… attach images or files with +'
      : attachmentCaps.images
        ? 'Whisper to the Vault… attach images with + or Ctrl+V'
        : 'Whisper to the Vault… attach CSV, PDF, or text files with +'
    : 'Whisper to the Vault…';

  return (
    <>
      {failoverToast && <QuestBanner variant="warn">{failoverToast}</QuestBanner>}

      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-precious-gold/70 mb-1">Sanctum</p>
          <h1 className="font-display text-2xl text-precious-gold-bright gold-glow tracking-wide">
            Chamber of Conversations
          </h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <select
            className="precious-input py-1.5 text-sm w-auto min-w-[12rem] uppercase tracking-wide"
            value={selectedModel}
            onChange={(e) => onSelectedModelChange(e.target.value)}
            style={{ color: '#dce4e0' }}
            aria-label="Model"
          >
            {modelOptions.map((m) => (
              <option
                key={modelSelectValue(m)}
                value={modelSelectValue(m)}
                style={{ background: '#0d1513', color: '#dce4e0' }}
              >
                {formatModelOptionLabel(m)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4">
        <QuotaCapacityBar summary={quotaSummary} compact />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-5 mb-4 precious-card p-4 md:p-5 scroll-smooth">
        <MemoizedChatMessageList
          messages={messages}
          isLoading={isLoading}
          errorMessage={errorMessage}
          awaitingReply={awaitingReply}
          messageMeta={messageMeta}
          lastAssistantId={lastAssistantId}
          streamingMeta={streamingMeta}
          chatErrorRef={chatErrorRef}
          setChatError={setChatError}
          reload={reload}
        />
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
  const searchParams = useSearchParams();
  const [models, setModels] = useState<ChatModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState(AUTO_MODEL);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [chatKey, setChatKey] = useState(0);
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [historyMeta, setHistoryMeta] = useState<Record<string, ChatResponseMeta>>({});
  const [historyReady, setHistoryReady] = useState(false);
  const [quotaRefreshKey, setQuotaRefreshKey] = useState(0);
  const convIdRef = useRef<string | null>(null);

  // Sync conversationId from URL
  useEffect(() => {
    const cid = searchParams.get('conversationId');
    if (cid && cid !== convIdRef.current) {
      convIdRef.current = cid;
      setConversationId(cid);
      setHistoryReady(false);
      loadHistory(cid);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const loadHistory = useCallback(async (cid: string) => {
    try {
      const res = await apiFetch<{
        messages: Array<{ role: string; content: string | null }>;
        metaMap?: Record<string, Record<string, unknown>>;
      }>(`/api/chat/messages?conversationId=${cid}`, undefined, { apiBase });
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
      } else {
        setHistoryMeta({});
      }
    } catch {
      setInitialMessages([]);
      setHistoryMeta({});
    } finally {
      setHistoryReady(true);
    }
  }, [apiBase]);

  // On mount: load models, then if URL has conversationId, load history.
  // If no conversationId, show empty ready state (user starts fresh).
  // Does NOT re-run on our own URL updates (skipPendingRef guards).
  const skipPendingRef = useRef(false);
  const urlCidRef = useRef<string | null>(null);

  useEffect(() => {
    loadModels();
    const cid = searchParams.get('conversationId');
    if (skipPendingRef.current) {
      skipPendingRef.current = false;
      return;
    }
    if (cid && cid !== urlCidRef.current) {
      urlCidRef.current = cid;
      convIdRef.current = cid;
      setConversationId(cid);
      setHistoryReady(false);
      loadHistory(cid);
    } else if (!cid) {
      urlCidRef.current = null;
      convIdRef.current = null;
      setConversationId(null);
      setHistoryReady(true);
      setInitialMessages([]);
      setHistoryMeta({});
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConversationCreated = (cid: string) => {
    convIdRef.current = cid;
    urlCidRef.current = cid;
    skipPendingRef.current = true;
    window.history.replaceState(null, '', `/chat?conversationId=${cid}`);
    window.dispatchEvent(new CustomEvent('precious:refresh-conversations'));
  };

  // Chat complete — trigger sidebar refresh
  const handleChatComplete = () => {
    setQuotaRefreshKey((k) => k + 1);
    window.dispatchEvent(new CustomEvent('precious:refresh-conversations'));
  };

  const hasRoutableModels = models.some((m) => m.id !== AUTO_MODEL);

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-full px-4 py-6 min-h-0">
      {!hasRoutableModels && models.length > 0 && historyReady && (
        <QuestBanner variant="warn">{copy.warn.chatNoKeys}</QuestBanner>
      )}

      {!historyReady ? (
        <p className="text-precious-muted text-sm animate-pulse py-20 text-center font-display">
          Loading conversation…
        </p>
      ) : (
        <ChatPanelInner
          key={`${conversationId ?? 'new'}-${chatKey}`}
          chatId={`chat-${conversationId ?? 'new'}-${chatKey}`}
          conversationId={conversationId}
          apiBase={apiBase}
          initialMessages={initialMessages}
          initialMeta={historyMeta}
          models={models}
          selectedModel={selectedModel}
          onSelectedModelChange={setSelectedModel}
          onChatComplete={handleChatComplete}
          onRefreshModels={loadModels}
          onConversationCreated={handleConversationCreated}
          quotaRefreshKey={quotaRefreshKey}
        />
      )}
    </div>
  );
}
