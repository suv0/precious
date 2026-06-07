import Link from 'next/link';
import { PageLayout } from '@/components/PageLayout';

export default function LocalPage() {
  return (
    <PageLayout>
      <article className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h1 className="font-display text-3xl text-precious-gold mb-2">Run Precious on your machine</h1>
          <p className="text-precious-muted">Full provider catalog. Keys never leave your box.</p>
        </div>

        <section className="precious-card p-6 space-y-4 text-precious-muted">
          <h2 className="font-display text-xl text-precious-text">When to use Local</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>You want 16+ providers, Ollama/LM Studio, custom endpoints</li>
            <li>Keys never touch our servers</li>
            <li>No Cloudflare 100k/day infra cap — only your provider limits apply</li>
            <li>Lower ToS risk — traffic goes direct from your machine</li>
          </ul>
        </section>

        <section className="precious-card p-6">
          <h2 className="font-display text-xl text-precious-gold mb-4">Quick start</h2>
          <pre className="bg-precious-bg rounded-lg p-4 text-sm text-emerald-300 overflow-x-auto">
{`# Clone and start
git clone <repo> precious && cd precious
cp apps/server/.env.example .env
docker compose up

# Dashboard at http://localhost:3001
# Dev mode:
npm install && npm run dev`}
          </pre>
        </section>

        <section className="text-precious-muted space-y-2">
          <p>
            <strong className="text-precious-text">No login needed.</strong> Open{' '}
            <code className="text-precious-gold">/settings/keys</code>, add provider keys, and chat.
          </p>
          <p>
            <code className="text-precious-gold">ENCRYPTION_KEY</code> auto-generated in{' '}
            <code className="text-precious-gold">./data/.env.local</code> on first run.
          </p>
          <p className="text-sm">
            Optional: set <code className="text-precious-gold">PRECIOUS_LOCAL_PASSWORD</code> on the
            server for simple password protection.
          </p>
          <p className="text-sm italic">You manage updates, encryption key, and backups yourself.</p>
        </section>

        <Link href="/docs" className="precious-btn-primary inline-flex">
          Provider key setup guides →
        </Link>
      </article>
    </PageLayout>
  );
}
