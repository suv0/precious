type QuestBannerVariant = 'success' | 'error' | 'warn';

const styles: Record<QuestBannerVariant, string> = {
  success:
    'text-precious-text bg-precious-emerald/40 border-precious-gold/30 shadow-[0_0_24px_rgba(13,59,46,0.35)]',
  error:
    'text-red-200 bg-red-950/35 border-red-800/45 shadow-[0_0_20px_rgba(127,29,29,0.25)]',
  warn:
    'text-precious-gold-bright bg-precious-gold/10 border-precious-gold/35 shadow-[0_0_20px_rgba(212,168,83,0.15)]',
};

export function QuestBanner({
  variant,
  children,
}: {
  variant: QuestBannerVariant;
  children: React.ReactNode;
}) {
  if (!children) return null;
  return (
    <div
      className={`text-sm border rounded-lg px-4 py-3 space-y-1 normal-case leading-relaxed ${styles[variant]}`}
      role="status"
    >
      <div className="font-display text-base tracking-wide">{children}</div>
    </div>
  );
}
