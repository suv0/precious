import { formatResponseMeta, type ChatResponseMeta } from '../lib/parse-chat-content';

export function ChatRouteMetaChip({ meta }: { meta: ChatResponseMeta | null }) {
  const line = meta ? formatResponseMeta(meta) : null;
  if (!line) return null;

  return (
    <span
      className="text-xs text-precious-gold/90 border border-emerald-800/60 bg-emerald-950/40 rounded-full px-3 py-1 font-mono tracking-tight"
      title="Provider and model used for the latest reply"
    >
      {line}
    </span>
  );
}
