type QuestBannerVariant = 'success' | 'error' | 'warn';

const styles: Record<QuestBannerVariant, string> = {
  success:
    'text-emerald-200 bg-emerald-950/40 border-emerald-700/50',
  error: 'text-red-200 bg-red-950/40 border-red-800/50',
  warn: 'text-amber-200 bg-amber-950/40 border-amber-800/50',
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
      <div className="font-display text-base">{children}</div>
    </div>
  );
}
