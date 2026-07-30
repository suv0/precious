import { formatResponseMeta, type ChatResponseMeta } from '../lib/parse-chat-content';

export function ChatRouteMetaChip({ meta }: { meta: ChatResponseMeta | null }) {
  const line = meta ? formatResponseMeta(meta) : null;
  if (!line) return null;

  return (
    <span
      className="text-[10px] uppercase tracking-wider text-precious-gold/90 border border-precious-gold/30 bg-precious-gold/10 rounded-full px-2.5 py-0.5 font-semibold"
      title="Provider and model used for the latest reply"
    >
      {line}
    </span>
  );
}
