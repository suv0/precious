import { PageLayout } from '@/components/PageLayout';
import { RiskBadge } from '@/components/RiskBadge';

const providers = [
  { name: 'Groq', risk: 'low' as const, note: 'Generally OK for app integration' },
  { name: 'Google Gemini', risk: 'medium' as const, note: 'Recent ToS narrows consumer vs business scope' },
  { name: 'Mistral', risk: 'low' as const, note: 'Personal/internal use generally OK' },
  { name: 'OpenRouter', risk: 'medium' as const, note: 'ToS restricts competing gateway services — you are building something adjacent' },
  { name: 'SambaNova', risk: 'high' as const, note: 'Service bureau language — excluded at cloud launch' },
  { name: 'Cohere', risk: 'high' as const, note: 'Personal use restrictions — excluded at launch' },
  { name: 'NVIDIA NIM', risk: 'high' as const, note: 'Evaluation-only — excluded at launch' },
];

export default function LegalPage() {
  return (
    <PageLayout>
      <article className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        <div>
          <h1 className="font-display text-3xl text-precious-gold mb-2">Terms, provider rules, and honest risks</h1>
          <p className="text-precious-muted">The most important page for trust.</p>
        </div>

        <section className="precious-card p-6 space-y-4 text-precious-muted">
          <h2 className="font-display text-xl text-precious-text">Our terms (simple)</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>Free personal tool; no warranty; may go offline anytime</li>
            <li>One person, one account; no reselling access to others</li>
            <li>You own your upstream accounts and must follow each provider&apos;s Terms of Service</li>
            <li>We are not responsible if a provider bans or rate-limits your key</li>
            <li>Abuse (spam signup, scraping, public API for strangers) = account removed</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl text-precious-gold mb-4">Provider ToS reality</h2>
          <div className="space-y-3">
            {providers.map((p) => (
              <div key={p.name} className="precious-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <span className="font-medium text-precious-text min-w-[140px]">{p.name}</span>
                <RiskBadge level={p.risk} />
                <span className="text-sm text-precious-muted flex-1">{p.note}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="precious-card p-6 border-amber-900/40">
          <h2 className="font-display text-xl text-amber-200 mb-3">What this means for you</h2>
          <p className="text-precious-muted leading-relaxed">
            This product routes <strong className="text-precious-text">your</strong> traffic through{' '}
            <strong className="text-precious-text">our</strong> servers to <strong className="text-precious-text">their</strong> APIs.
            Some providers may consider that a proxy or gateway. We cannot guarantee your keys will never be flagged.{' '}
            <strong className="text-precious-text">Use at your own risk.</strong> When in doubt, use providers marked
            &quot;Low risk&quot; or use Local mode.
          </p>
        </section>

        <p className="text-sm text-precious-muted italic">
          We are developers, not lawyers. This page is our honest understanding, not legal counsel. Read each provider&apos;s ToS yourself.
        </p>
      </article>
    </PageLayout>
  );
}
