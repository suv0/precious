import { PageLayout } from '@/components/PageLayout';

export default function PrivacyPage() {
  return (
    <PageLayout>
      <article className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="font-display text-3xl text-precious-gold mb-2">What we collect</h1>
        <p className="text-precious-muted mb-8">Transparency about your data.</p>

        <div className="overflow-x-auto precious-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-emerald-900/60 text-left text-precious-muted">
                <th className="p-4">Data</th>
                <th className="p-4">Stored?</th>
                <th className="p-4">Why</th>
              </tr>
            </thead>
            <tbody className="text-precious-muted">
              {[
                ['Email / auth identity', 'Yes', 'Login'],
                ['Provider API keys', 'Yes, encrypted', 'Routing your requests'],
                ['Chat messages', 'Yes (local: optional)', 'Chat history feature'],
                ['Request metadata', 'Yes', 'Analytics for you'],
                ['Upstream prompt content', 'Transient during request', 'Not logged by default in Local mode'],
                ['Payment info', 'No', 'We are free'],
              ].map(([data, stored, why]) => (
                <tr key={data} className="border-b border-emerald-900/30">
                  <td className="p-4 text-precious-text">{data}</td>
                  <td className="p-4">{stored}</td>
                  <td className="p-4">{why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 space-y-4 text-precious-muted leading-relaxed">
          <p><strong className="text-precious-text">We do not sell data.</strong> We do not train models on your chats. We do not share keys with other users.</p>
          <p>Retention: chat history and analytics are kept until you delete your account or clear data. Local mode: everything stays on your machine.</p>
        </div>
      </article>
    </PageLayout>
  );
}
