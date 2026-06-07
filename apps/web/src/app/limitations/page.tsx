import { PageLayout } from '@/components/PageLayout';

export default function LimitationsPage() {
  return (
    <PageLayout>
      <article className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="font-display text-3xl text-precious-gold mb-2">What this is not</h1>
        <p className="text-precious-muted mb-8">Honest expectations, no hype.</p>

        <ul className="space-y-4">
          {[
            'Not unlimited GPT-5 / Claude Opus — free tiers only, quality varies',
            'Not production-grade SLA — hobby project, can break',
            'Not for teams or sharing with friends — personal workspace',
            'Not a way to bypass paid tiers or provider rules',
            'Intelligence drops through the day as daily quotas exhaust (by design of free tiers)',
          ].map((item) => (
            <li key={item} className="precious-card p-4 text-precious-muted flex gap-3">
              <span className="text-precious-gold">✗</span>
              {item}
            </li>
          ))}
        </ul>

        <section className="mt-12 precious-card p-6">
          <h2 className="font-display text-xl text-precious-gold mb-4">Limits in local mode</h2>
          <div className="space-y-4 text-sm text-precious-muted">
            <div>
              <strong className="text-precious-text">Provider limits</strong> — Google, Groq, etc. set RPM and daily tokens on your free tier. Precious does not cap this; failover kicks in when you hit their cap.
            </div>
            <div>
              <strong className="text-precious-text">Your machine / VPS</strong> — throughput depends on your hardware and network, not a shared cloud quota.
            </div>
          </div>
          <p className="mt-4 text-precious-muted italic">
            Built for hobby scale and self-hosting. Hosted cloud deployments may add shared infra caps separately.
          </p>
        </section>
      </article>
    </PageLayout>
  );
}
