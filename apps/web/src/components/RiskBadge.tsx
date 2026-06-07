export function RiskBadge({ level }: { level: 'low' | 'medium' | 'high' }) {
  const labels = { low: 'Low risk', medium: 'Medium risk', high: 'High risk' };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium risk-${level}`}>
      {labels[level]}
    </span>
  );
}
