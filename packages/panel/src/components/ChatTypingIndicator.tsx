export function ChatTypingIndicator() {
  return (
    <div className="flex justify-start gap-2.5 items-start" aria-live="polite" aria-label="Assistant is typing">
      <span
        className="shrink-0 w-8 h-8 rounded-full bg-precious-gold/15 border border-precious-gold/40 flex items-center justify-center text-precious-gold"
        aria-hidden
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3z" />
        </svg>
      </span>
      <div className="rounded-xl rounded-tl-md px-4 py-3 bg-precious-emerald/25 border border-precious-emerald/50">
        <div className="flex gap-1.5 items-center h-5">
          <span className="w-1.5 h-1.5 rounded-full bg-precious-gold/70 animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-precious-gold/70 animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-precious-gold/70 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
