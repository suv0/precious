export function ChatTypingIndicator() {
  return (
    <div className="flex justify-start gap-2.5 items-start" aria-live="polite" aria-label="Assistant is typing">
      <span
        className="shrink-0 w-7 h-7 rounded-full bg-precious-gold/15 border border-precious-gold/30 flex items-center justify-center text-xs"
        aria-hidden
      >
        ✦
      </span>
      <div className="rounded-2xl rounded-tl-md px-4 py-3 bg-precious-surface/90 border border-emerald-900/50">
        <div className="flex gap-1.5 items-center h-5">
          <span className="w-1.5 h-1.5 rounded-full bg-precious-gold/70 animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-precious-gold/70 animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-precious-gold/70 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
