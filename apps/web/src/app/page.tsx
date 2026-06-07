import Link from 'next/link';
import { PageLayout } from '@/components/PageLayout';

export default function HomePage() {
  return (
    <PageLayout showHeader={false}>
      <section className="relative overflow-hidden px-6 py-24 text-center">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/30 to-transparent pointer-events-none" />
        <div className="relative max-w-3xl mx-auto">
          <div className="text-5xl mb-4">💍</div>
          <h1 className="font-display text-5xl md:text-6xl font-bold text-precious-gold gold-glow mb-4">
            Precious
          </h1>
          <p className="font-display text-xl md:text-2xl text-precious-text/90 italic mb-2">
            One key to rule them all.
          </p>
          <p className="text-lg text-precious-muted mb-12">
            Every LLM. Your keys. Our router.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link href="/local" className="precious-btn-primary text-lg px-8 py-3">
              Run Local — Docker or npm
            </Link>
            <Link href="/chat" className="precious-btn-gold text-lg px-8 py-3">
              Open Chat
            </Link>
          </div>

          <div className="precious-card p-8 text-left max-w-xl mx-auto">
            <h2 className="font-display text-precious-gold text-lg mb-3">Self-host first</h2>
            <p className="text-precious-muted leading-relaxed">
              This open-source build is designed for <strong className="text-precious-text">Precious Local</strong> — keys stay on your machine.
              Hosted signup is offered separately as a private cloud product (not in this repo).
            </p>
            <p className="text-sm text-precious-muted mt-4 italic">
              Forged in localhost.
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 py-16 border-t border-emerald-900/30">
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-6">
          {[
            { title: 'One unified key', desc: 'prec_… works in Cursor, Python, LangChain — one endpoint.' },
            { title: 'Smart failover', desc: 'Rate limited? We try the next provider.' },
            { title: 'Honest by design', desc: 'Security, privacy, and legal pages before you paste a single key.' },
          ].map((f) => (
            <div key={f.title} className="precious-card p-6">
              <h3 className="font-display text-precious-gold mb-2">{f.title}</h3>
              <p className="text-sm text-precious-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </PageLayout>
  );
}
