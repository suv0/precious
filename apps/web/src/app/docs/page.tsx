import Link from 'next/link';
import { PageLayout } from '@/components/PageLayout';
import { RiskBadge } from '@/components/RiskBadge';

const cloudGuides = [
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
    id: 'openai',
    title: 'OpenAI',
    risk: 'medium' as const,
    steps: [
      'Sign in at platform.openai.com',
      'Go to API keys → Create new secret key',
      'Copy the key (starts with sk-)',
      'In Precious Settings → Keys, select OpenAI and paste',
    ],
    url: 'https://platform.openai.com/api-keys',
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
];

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="mt-2 rounded-lg bg-precious-bg border border-emerald-900/50 p-3 text-xs text-precious-gold font-mono overflow-x-auto">
      {children}
    </pre>
  );
}

export default function DocsPage() {
  return (
    <PageLayout>
      <article className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="font-display text-3xl text-precious-gold mb-2">Provider key setup</h1>
        <p className="text-precious-muted mb-8">
          Step-by-step guides. The journey there and back again — except the model picks the route.
        </p>

        <div className="space-y-8">
          {cloudGuides.map((g) => (
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

          <section id="custom" className="precious-card p-6 scroll-mt-20">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="font-display text-xl text-precious-text">Custom OpenAI-compatible (Ollama)</h2>
              <RiskBadge level="medium" />
            </div>

            <p className="text-precious-muted mb-4 leading-relaxed">
              Use this for models running on <strong className="text-precious-text">your own computer</strong> —
              no API signup, no credit card. Ollama is the easiest way to start. Precious talks to it using the
              same OpenAI-style API that tools like Cursor use.
            </p>

            <h3 className="font-display text-precious-text mb-2">1. Install Ollama</h3>
            <ol className="list-decimal pl-5 space-y-2 text-precious-muted mb-4">
              <li>
                Download from{' '}
                <Link href="https://ollama.com/download" target="_blank" className="text-precious-gold hover:underline">
                  ollama.com/download
                </Link>{' '}
                (Windows, Mac, or Linux).
              </li>
              <li>Run the installer. On Windows and Mac, Ollama usually runs in the background automatically.</li>
              <li>
                Optional check: open a terminal and run <code className="text-precious-gold">ollama --version</code>.
              </li>
            </ol>

            <h3 className="font-display text-precious-text mb-2">2. Download a model</h3>
            <p className="text-precious-muted mb-2">
              Pick one model and remember its <em>exact</em> name — Precious must use the same spelling in Chat.
            </p>
            <CodeBlock>{`ollama pull llama3.2`}</CodeBlock>
            <p className="text-precious-muted mt-2 mb-4 text-sm">
              Other popular choices: <code className="text-precious-gold">llama3.1</code>,{' '}
              <code className="text-precious-gold">mistral</code>, <code className="text-precious-gold">phi3</code>.
              Run <code className="text-precious-gold">ollama list</code> to see what you have installed.
            </p>

            <h3 className="font-display text-precious-text mb-2">3. Confirm the server is running</h3>
            <p className="text-precious-muted mb-2">
              Ollama listens on <code className="text-precious-gold">http://localhost:11434</code>. Quick test
              (PowerShell or terminal):
            </p>
            <CodeBlock>{`curl http://localhost:11434/v1/models`}</CodeBlock>
            <p className="text-precious-muted mt-2 mb-4 text-sm">
              You should see JSON listing your models. If this fails, open the Ollama app or run{' '}
              <code className="text-precious-gold">ollama serve</code>.
            </p>

            <h3 className="font-display text-precious-text mb-2">4. Add the key in Precious</h3>
            <p className="text-precious-muted mb-2">
              Go to <Link href="/settings/keys" className="text-precious-gold hover:underline">Keys & routing</Link>{' '}
              → Add provider key → <strong className="text-precious-text">Custom OpenAI-compatible</strong>.
              Fill in:
            </p>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm text-left border border-emerald-900/50 rounded-lg">
                <thead>
                  <tr className="border-b border-emerald-900/50 text-precious-muted">
                    <th className="p-3 font-display">Field</th>
                    <th className="p-3 font-display">What to enter</th>
                  </tr>
                </thead>
                <tbody className="text-precious-muted">
                  <tr className="border-b border-emerald-900/30">
                    <td className="p-3 text-precious-text">Label</td>
                    <td className="p-3 font-mono text-precious-gold">My Ollama</td>
                  </tr>
                  <tr className="border-b border-emerald-900/30">
                    <td className="p-3 text-precious-text">API key</td>
                    <td className="p-3 font-mono text-precious-gold">ollama</td>
                  </tr>
                  <tr>
                    <td className="p-3 text-precious-text">Base URL</td>
                    <td className="p-3 font-mono text-precious-gold">http://localhost:11434/v1</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-precious-muted mb-4 text-sm leading-relaxed">
              The API key is not a real secret for local Ollama — Precious requires the field, but Ollama ignores
              it. The base URL <strong className="text-precious-text">must end with</strong>{' '}
              <code className="text-precious-gold">/v1</code> (not just port 11434).
            </p>

            <h3 className="font-display text-precious-text mb-2">5. Chat</h3>
            <ol className="list-decimal pl-5 space-y-2 text-precious-muted mb-4">
              <li>Open Chat and pick your model from the dropdown, e.g. Custom · llama3.2.</li>
              <li>
                The name must match <code className="text-precious-gold">ollama list</code> exactly (including dots
                and version numbers).
              </li>
              <li>Send a message. Replies run on your GPU/CPU — they can be slower than cloud APIs.</li>
            </ol>

            <h3 className="font-display text-precious-text mb-2">Troubleshooting</h3>
            <ul className="list-disc pl-5 space-y-2 text-precious-muted mb-4 text-sm">
              <li>
                <strong className="text-precious-text">Connection refused</strong> — Ollama is not running. Start
                the Ollama app or run <code className="text-precious-gold">ollama serve</code>.
              </li>
              <li>
                <strong className="text-precious-text">Model not found</strong> — Run{' '}
                <code className="text-precious-gold">ollama pull &lt;name&gt;</code> and pick that exact name in
                Chat.
              </li>
              <li>
                <strong className="text-precious-text">Wrong URL</strong> — Use{' '}
                <code className="text-precious-gold">http://localhost:11434/v1</code>, not the old GitHub FAQ
                link. See{' '}
                <Link
                  href="https://docs.ollama.com/api/openai-compatibility"
                  target="_blank"
                  className="text-precious-gold hover:underline"
                >
                  Ollama OpenAI compatibility docs
                </Link>
                .
              </li>
            </ul>

            <h3 className="font-display text-precious-text mb-2">Other local servers</h3>
            <p className="text-precious-muted mb-4 text-sm leading-relaxed">
              <strong className="text-precious-text">LM Studio</strong> — enable the local server in the app, then
              use its base URL (often <code className="text-precious-gold">http://localhost:1234/v1</code>) and any
              placeholder API key.{' '}
              <Link
                href="https://lmstudio.ai/docs/api/openai-api"
                target="_blank"
                className="text-precious-gold hover:underline"
              >
                LM Studio OpenAI API docs →
              </Link>
            </p>

            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <Link
                href="https://docs.ollama.com/api/openai-compatibility"
                target="_blank"
                className="text-precious-gold text-sm hover:underline"
              >
                Ollama OpenAI API docs →
              </Link>
              <Link
                href="https://ollama.com/download"
                target="_blank"
                className="text-precious-muted text-sm hover:text-precious-gold hover:underline"
              >
                Download Ollama →
              </Link>
            </div>
          </section>
        </div>

        <p className="mt-8 text-sm text-precious-muted">
          Read <Link href="/legal" className="text-precious-gold hover:underline">Legal / ToS</Link> before adding keys.
        </p>
      </article>
    </PageLayout>
  );
}
