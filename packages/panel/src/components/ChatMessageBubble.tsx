import { useState } from 'react';
import { isImageFile } from '../lib/attachment-files';
import {
  formatResponseMeta,
  parseChatContent,
  type ChatResponseMeta,
  type RouteAttempt,
} from '../lib/parse-chat-content';
import { MarkdownLite } from '../lib/render-markdown-lite';
import { ChatRouteMetaChip } from './ChatRouteMetaChip';

export function ChatMessageBubble({
  role,
  content,
  meta,
  attachments,
}: {
  role: 'user' | 'assistant' | 'system' | 'data';
  content: string;
  meta?: ChatResponseMeta;
  attachments?: Array<{ url?: string; name?: string; contentType?: string }>;
}) {
  const isUser = role === 'user';
  const parsed = isUser ? { text: content } : parseChatContent(content);
  const displayMeta = !isUser ? (meta ?? parsed.meta) : undefined;
  const imageAttachments =
    attachments?.filter((a) => a.url && isImageFile(a)) ?? [];
  const fileAttachments =
    attachments?.filter((a) => a.url && !isImageFile(a)) ?? [];

  async function copyText() {
    try {
      await navigator.clipboard.writeText(parsed.text);
    } catch {
      /* clipboard denied */
    }
  }

  const copyBtn = (
    <button
      type="button"
      onClick={copyText}
      className="text-[10px] text-precious-muted hover:text-precious-gold opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
      title="Copy message"
      aria-label="Copy message"
    >
      Copy
    </button>
  );

  if (isUser) {
    return (
      <div className="group flex justify-end gap-2 items-end">
        {copyBtn}
        <div className="max-w-[78%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm bg-emerald-700/50 text-precious-text shadow-sm space-y-2">
          {imageAttachments.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {imageAttachments.map((a) => (
                <li key={a.url} className="rounded-lg overflow-hidden border border-emerald-600/30">
                  <img src={a.url} alt={a.name ?? 'Attached image'} className="max-h-40 max-w-full object-cover" />
                </li>
              ))}
            </ul>
          )}
          {fileAttachments.length > 0 && (
            <ul className="space-y-1">
              {fileAttachments.map((a) => (
                <li
                  key={a.url}
                  className="text-xs text-precious-muted bg-emerald-950/40 rounded px-2 py-1 border border-emerald-800/40"
                >
                  📄 {a.name ?? 'Attached file'}
                </li>
              ))}
            </ul>
          )}
          {parsed.text.trim() ? (
            <p className="whitespace-pre-wrap break-words leading-relaxed">{parsed.text}</p>
          ) : null}
        </div>
        <span
          className="shrink-0 w-7 h-7 rounded-full bg-emerald-800/80 border border-emerald-600/30 flex items-center justify-center text-[10px] font-display text-precious-gold"
          aria-hidden
        >
          You
        </span>
      </div>
    );
  }

  return (
    <div className="group flex justify-start gap-2.5 items-start max-w-[92%]">
      <span
        className="shrink-0 w-7 h-7 mt-0.5 rounded-full bg-precious-gold/15 border border-precious-gold/30 flex items-center justify-center text-xs"
        aria-hidden
        title="Assistant"
      >
        ✦
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        {displayMeta && (displayMeta.provider || displayMeta.model) && (
          <ChatRouteMetaChip meta={displayMeta} />
        )}
        <div className="rounded-2xl rounded-tl-md px-4 py-3 text-sm bg-precious-surface/90 border border-emerald-900/50 text-precious-text shadow-sm">
          <MarkdownLite text={parsed.text} />
          {displayMeta?.tokens != null && !Number.isNaN(displayMeta.tokens) && (
            <p className="mt-3 pt-2 border-t border-emerald-900/40 text-[11px] text-precious-muted">
              {formatResponseMeta({ tokens: displayMeta.tokens })}
            </p>
          )}
        </div>
        {displayMeta?.trail && displayMeta.trail.length > 0 && (
          <RouteTrailChip trail={displayMeta.trail} />
        )}
        {copyBtn}
      </div>
    </div>
  );
}

function RouteTrailChip({ trail }: { trail: RouteAttempt[] }) {
  const [open, setOpen] = useState(false);

  const skipped = trail.filter((a) => a.result !== 'success');
  const label = skipped.length > 0
    ? skipped.map((a) => (a.result === 'skipped' ? `↷ ${a.provider}` : `✕ ${a.provider}`)).join(' → ')
    : `✓ ${trail[0]!.provider}`;
  if (!label) return null;

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-[10px] text-precious-muted/50 hover:text-precious-muted/80 transition-colors font-mono tracking-tight"
        title="Routing trail — which providers were tried before this one replied"
      >
        ⚡ {label} {open ? '▾' : '▸'}
      </button>
      {open && (
        <div className="text-[10px] text-precious-muted/80 space-y-0.5 pl-2 border-l border-emerald-900/30">
          {trail.map((a, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className={a.result === 'success' ? 'text-emerald-400/70' : a.result === 'error' ? 'text-red-400/70' : 'text-amber-400/60'}>
                {a.result === 'success' ? '✓' : a.result === 'error' ? '✕' : '↷'}
              </span>
              <span className="text-precious-text/60">{a.provider}</span>
              <span className="text-precious-muted/50">{a.model}</span>
              {a.error && <span className="text-red-400/60 break-all">{a.error.slice(0, 80)}</span>}
              {a.skipped && <span className="text-amber-400/50">{a.skipped}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
