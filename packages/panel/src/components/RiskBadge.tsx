export function RiskBadge({ level }: { level: 'low' | 'medium' | 'high' }) {
  const cls =
    level === 'low' ? 'risk-low' : level === 'medium' ? 'risk-medium' : 'risk-high';
  return (
    <span
      className={`ml-2 inline-flex items-center text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-display ${cls}`}
    >
      {level} risk
    </span>
  );
}

export function HealthDot({ status }: { status?: string | null }) {
  const color =
    status === 'healthy'
      ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
      : status === 'rate_limited'
        ? 'bg-precious-gold shadow-[0_0_8px_rgba(212,168,83,0.7)]'
        : status === 'invalid'
          ? 'bg-red-400 shadow-[0_0_8px_#f87171]'
          : 'bg-precious-muted/50';
  const pulse = status === 'healthy' ? 'vault-pulse' : '';
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${color} ${pulse}`}
      title={status ?? 'unknown'}
    />
  );
}
