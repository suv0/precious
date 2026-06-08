import Link from 'next/link';
import { PageLayout } from '@/components/PageLayout';
import { RiskBadge } from '@/components/RiskBadge';

const guides = [
  {
    id: 'groq',
    title: 'Groq',
    risk: 'low' as const,
    steps: [
      'Go to console.groq.com and create an account',
      'Navigate to API Keys → Create API Key',
      'Copy the key (starts with gsk_)',
      'In Precious Settings → Keys, select Groq and paste',
    ],
    url: 'https://console.groq.com/keys',
  },
  {
    id: 'google-gemini',
    title: 'Google Gemini',
    risk: 'medium' as const,
    steps: [
      'Go to aistudio.google.com/apikey',
      'Create API key in Google AI Studio',
      'Copy the key',
      'In Precious, select Google Gemini and paste',
    ],
    url: 'https://aistudio.google.com/apikey',
  },
  {
    id: 'openrouter',
    title: 'OpenRouter',
    risk: 'medium' as const,
    steps: [
      'Sign up at openrouter.ai',
      'Go to Keys → Create Key',
      'Copy the key (starts with sk-or-)',
      'In Precious, select OpenRouter and paste',
    ],
    url: 'https://openrouter.ai/keys',
  },
  {
    id: 'mistral',
    title: 'Mistral',
    risk: 'low' as const,
    steps: [
      'Sign up at console.mistral.ai',
      'Create an API key under API Keys',
      'Copy the key',
      'In Precious, select Mistral and paste',
    ],
    url: 'https://console.mistral.ai/api-keys',
  },
  {
    id: 'custom',
    title: 'Custom OpenAI-compatible',
    risk: 'medium' as const,
    steps: [
      'Run Ollama, LM Studio, vLLM, or any OpenAI-compatible server',
      'Note the base URL (e.g. http://localhost:11434/v1)',
      'In Precious, select Custom OpenAI-compatible',
      'Enter base URL and API key (often "ollama" or empty for local)',
    ],
    url: 'https://github.com/ollama/ollama/blob/main/docs/api.md',
  },
];

export default function DocsPage() {
  return (
    <PageLayout>
      <article className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="font-display text-3xl text-precious-gold mb-2">Provider key setup</h1>
        <p className="text-precious-muted mb-8">
          Step-by-step guides. The journey there and back again — except the model picks the route.
        </p>

        <div className="space-y-8">
          {guides.map((g) => (
            <section key={g.id} id={g.id} className="precious-card p-6 scroll-mt-20">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="font-display text-xl text-precious-text">{g.title}</h2>
                <RiskBadge level={g.risk} />
              </div>
              <ol className="list-decimal pl-5 space-y-2 text-precious-muted mb-4">
                {g.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <Link href={g.url} target="_blank" className="text-precious-gold text-sm hover:underline">
                Official docs →
              </Link>
            </section>
          ))}
        </div>

        <p className="mt-8 text-sm text-precious-muted">
          Read <Link href="/legal" className="text-precious-gold hover:underline">Legal / ToS</Link> before adding keys.
        </p>
      </article>
    </PageLayout>
  );
}
