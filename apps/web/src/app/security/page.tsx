import { PageLayout } from '@/components/PageLayout';

export default function SecurityPage() {
  return (
    <PageLayout>
      <article className="max-w-3xl mx-auto px-6 py-12 prose-precious">
        <h1 className="font-display text-3xl text-precious-gold mb-2">How we handle your keys</h1>
        <p className="text-precious-muted mb-8">Plain language, not lawyer-speak.</p>

        <section className="space-y-6 text-precious-muted leading-relaxed">
          <div className="precious-card p-6">
            <h2 className="font-display text-xl text-precious-text mb-4">What we do</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Provider keys are <strong className="text-precious-text">encrypted at rest</strong> (AES-256-GCM) before they touch the database</li>
              <li>Encryption secret lives <strong className="text-precious-text">only on the server</strong> — never in the browser, never in git</li>
              <li>Unified API keys are <strong className="text-precious-text">hashed</strong> (like GitHub tokens — shown once, then only a hash remains)</li>
              <li><strong className="text-precious-text">Strict tenant isolation</strong> — your keys are scoped to your account</li>
              <li><strong className="text-precious-text">HTTPS only</strong>; CORS locked to our domain</li>
              <li><strong className="text-precious-text">Audit log</strong> when provider keys are read or used</li>
              <li><strong className="text-precious-text">Delete anytime</strong> — account deletion wipes encrypted keys and chat history</li>
            </ul>
          </div>

          <div className="precious-card p-6 border-amber-900/40">
            <h2 className="font-display text-xl text-amber-200 mb-4">What we cannot promise</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>We are a <strong className="text-precious-text">free hobby project</strong>, not a bank or enterprise security vendor</li>
              <li>No SOC 2, no penetration test budget, no 24/7 security team</li>
              <li>A breach would expose encrypted blobs — encryption helps, but ENCRYPTION_KEY theft would be catastrophic</li>
              <li><strong className="text-precious-text">You trust us with secrets you would otherwise keep on your own machine</strong></li>
            </ul>
          </div>

          <div className="precious-card p-6">
            <h2 className="font-display text-xl text-precious-text mb-4">What you should do</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Only add keys you are comfortable storing on a third-party server</li>
              <li>Use provider keys with minimal permissions where possible</li>
              <li>Rotate keys if you ever stop using the service</li>
              <li>Do not store keys to accounts with payment methods attached unless you accept the risk</li>
            </ul>
          </div>
        </section>
      </article>
    </PageLayout>
  );
}
