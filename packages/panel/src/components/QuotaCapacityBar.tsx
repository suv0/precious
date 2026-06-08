import type { UsageSummary } from '../lib/api';
import { providerBarColors } from '../lib/provider-bar-colors';

function formatReset(ms: number | null): string {
  if (ms == null) return '';
  const diff = ms - Date.now();
  if (diff <= 0) return 'resets soon';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 0) return `resets in ${h}h ${m}m`;
  return `resets in ${m}m`;
}

export function QuotaCapacityBar({
  summary,
  compact = false,
}: {
  summary: UsageSummary | null;
  compact?: boolean;
}) {
  if (!summary || summary.segments.length === 0) return null;

  return (
    <div
      className="space-y-2"
      title="Requests routed through Precious today vs estimated daily budget per provider. Provider quotas may differ."
    >
      <div className="flex items-center justify-between gap-2 text-[11px] text-precious-muted">
        <span className="font-display tracking-wide text-precious-muted/90">
          Routing budget
        </span>
        {!compact && summary.resetsDayAt && (
          <span>{formatReset(summary.resetsDayAt)}</span>
        )}
      </div>

      {/* Stacked battery: each provider owns a slice; charge drains left → right */}
      <div
        className="flex h-3.5 w-full rounded-full overflow-hidden border border-emerald-900/60 bg-precious-bg/80 shadow-inner"
        role="meter"
        aria-label="Combined provider routing budget"
      >
        {summary.segments.map((seg) => {
          const colors = providerBarColors(seg.providerId);
          const remainingPct = Math.round(seg.remainingFraction * 100);
          return (
            <div
              key={seg.providerId}
              className={`relative h-full border-r border-emerald-950/50 last:border-r-0 ${colors.drained}`}
              style={{ width: `${seg.weightPercent}%` }}
              role="meter"
              aria-valuenow={remainingPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${seg.label} ${remainingPct}% remaining`}
              title={`${seg.label}: ${seg.usedToday.toLocaleString()} / ${seg.dailyLimit.toLocaleString()} requests today (${remainingPct}% left)`}
            >
              {/* Remaining "charge" fills from the right */}
              <div
                className={`absolute inset-y-0 right-0 ${colors.charge} transition-all duration-500 ease-out`}
                style={{ width: `${remainingPct}%` }}
              />
            </div>
          );
        })}
      </div>

      <ul className={`flex flex-wrap gap-x-4 gap-y-1 ${compact ? 'text-[10px]' : 'text-xs'} text-precious-muted`}>
        {summary.segments.map((seg) => {
          const colors = providerBarColors(seg.providerId);
          return (
            <li key={seg.providerId} className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-sm ${colors.charge} ring-1 ${colors.ring}`}
                aria-hidden
              />
              <span>
                {seg.label}{' '}
                <span className="text-precious-text/80 font-mono">
                  {Math.round(seg.remainingFraction * 100)}%
                </span>
                {!compact && (
                  <span className="text-precious-muted/70">
                    {' '}
                    ({seg.usedToday}/{seg.dailyLimit})
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
