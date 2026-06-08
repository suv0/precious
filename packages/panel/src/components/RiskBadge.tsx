export function RiskBadge({ level }: { level: 'low' | 'medium' | 'high' }) {
  const cls =
    level === 'low' ? 'risk-low' : level === 'medium' ? 'risk-medium' : 'risk-high';
  return (
    <span className={`ml-2 text-xs px-2 py-0.5 rounded border ${cls}`}>{level} risk</span>
  );
}

export function HealthDot({ status }: { status?: string | null }) {
  const color =
    status === 'healthy'
      ? 'bg-emerald-400'
      : status === 'rate_limited'
        ? 'bg-amber-400'
        : status === 'invalid'
          ? 'bg-red-400'
          : 'bg-gray-500';
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${color}`}
      title={status ?? 'unknown'}
    />
  );
}
