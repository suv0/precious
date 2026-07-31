# 💍 Precious

> **One key to rule them all.**
> *Every LLM. Your keys. Our router.*

**Precious is a self-hosted LLM router.** You add your own API keys from different providers (Groq, Gemini, OpenAI, etc.), and Precious routes your chat requests through them in a fallback chain. When one provider hits its rate limit, Precious automatically switches to the next — with full conversation context. No interruptions. No starting over.

Add enough API keys and you get near-unlimited AI usage without paying a dime for any subscription.

---

## The problem it solves

You're on the free tier of ChatGPT, Claude, or Gemini. You're having a long conversation, then suddenly — **"You've hit your usage limit."** You switch to another app, but it has no idea what you were talking about. You start explaining everything from scratch. Repeat daily.

Precious fixes this. Add your free-tier API keys from multiple providers. When one runs out, Precious silently fails over to the next. Your conversation continues as if nothing happened. The context — every message, every tool call, every file — is forwarded to the next provider intact.

---

## How it works

```
You (Browser / API) ──▶ Precious ──▶ Groq (rate limited? → cooldown)
                         │           ▶ Gemini ──▶ Response
                         │           ▶ OpenRouter (backup)
                         │           ▶ Mistral (backup)
                         │           ▶ ... (as many as you add)
                         │
                         ▼
                    One prec_ API key
                   (use in Cursor, Python, LangChain — anything)
```

- **Auto failover:** Rate limit? Quota exhausted? Precious tries the next provider in your chain immediately. You never see raw provider errors in chat.
- **Full context on failover:** The entire conversation history is re-sent to every retry. Multi-turn conversations survive provider switches.
- **Sticky sessions:** Once a provider responds successfully, Precious prefers it for 30 minutes for lower latency.
- **Provider cooldown:** A provider that fails goes on a 30-second cooldown so Precious doesn't keep hammering it.

---

## Quick start

### Prerequisites

- **Docker Desktop** (or Docker Engine + Docker Compose) — [download](https://docs.docker.com/get-docker/)
- Or if you prefer without Docker: **Node.js 20+** — [download](https://nodejs.org/)

### Docker (recommended — no Node.js required)

```bash
git clone https://github.com/suv0/precious.git
cd precious
docker compose up -d
# Open http://localhost:3001/settings/keys
```

### Local dev (Node.js 20+)

```bash
git clone https://github.com/suv0/precious.git
cd precious
npm install
npm run build:core && npm run build:db && npm run build:providers

# Terminal 1 — API server (port 3001)
npm run dev:server

# Terminal 2 — Panel UI (port 3000)
npm run dev:web
```

Open **http://localhost:3000/settings/keys** (or **http://localhost:3001** with Docker). No login required — you're straight in.

---

## Adding your first provider key

1. Open **Keys & routing** in the panel
2. Pick a provider from the dropdown (Groq, Gemini, etc.)
3. Paste your API key
4. Click **Add key**

That's it. Your fallback chain is built automatically. Open **Chat**, select **Auto (best available)**, and start talking. Precious handles the rest.

Every provider page links directly to where you can create a free API key. Many providers have generous free tiers — Groq, Gemini, Mistral, Cloudflare, and more cost nothing to get started.

---

## Unified API key — use Precious as your own API

Generate a single `prec_` key that works in any OpenAI-compatible client:

```bash
# Generate in the Keys page, then:
curl http://localhost:3001/v1/chat/completions \
  -H "Authorization: Bearer prec_..." \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

Use `model: "auto"` to walk your entire fallback chain. All your provider keys become one endpoint. Works with **Cursor, Zed, Continue.dev, LangChain, Python OpenAI library** — anything that speaks the OpenAI API.

---

## Supported providers (17 adapters)

| Provider | Free Tier | Notes |
|----------|-----------|-------|
| **Groq** | ✅ | Fast inference, generous free tier |
| **Google Gemini** | ✅ | Vision, PDFs, 1,500 req/day free |
| **OpenAI** | ❌ | Requires billing ($5 minimum) |
| **OpenRouter** | ✅ | 200+ models, many free |
| **Mistral** | ✅ | Strong free tier |
| **Cerebras** | ✅ | Very fast, generous limits |
| **Cloudflare Workers AI** | ✅ | 10k neurons/day free |
| **GitHub Models** | ✅ | Free with GitHub account |
| **HuggingFace** | ✅ | Free credits monthly |
| **Cohere** | ✅ | Trial tier available |
| **Ollama Cloud** | ✅ | Free plan |
| **Zhipu (GLM)** | ✅ | Free tier available |
| **OpenCode Zen** | ✅ | Free promotional tier |
| **LLM7** | ✅ | ~100 req/hr free |
| **NVIDIA NIM** | ✅ | Eval tier |
| **Pollinations** | ✅ | Keyless — anonymous access |
| **Kilo** | ✅ | Keyless — free routes |
| **Custom (OpenAI-compatible)** | — | Ollama, LM Studio, any local server |

See [PROVIDERS_BACKLOG.md](./PROVIDERS_BACKLOG.md) for upcoming providers and contributions.

---

## Architecture

```
packages/core/       Router engine, encryption (AES-256-GCM), rate limiting
packages/providers/  17 LLM provider adapters
packages/panel/      Shared React UI — chat, keys, audit trail
packages/db/         Drizzle ORM schema, migrations (SQLite / libSQL)
apps/server/         Hono API server (local mode)
apps/web/            Next.js static-export panel shell
```

Built with **Node.js 20+**, **Hono**, **React 19**, **Next.js 15**, **Drizzle ORM**, **SQLite**. Single statically-linked Docker image. Under 12k lines of TypeScript.

---

## Security

- Provider API keys are **encrypted at rest** with AES-256-GCM
- Unified keys (`prec_*`) are stored as **bcrypt hashes** (cost 12) — not reversible
- Session tokens are 256-bit random, httpOnly cookies
- Local mode runs on `127.0.0.1` by default — not exposed to your network
- Provider errors are never echoed to chat
- Custom provider URLs are validated to prevent SSRF

For local use, Precious is designed to run on your machine, behind your firewall. If you need multi-user cloud hosting, **Precious Cloud** is available in a separate private deployment.

---

## Troubleshooting

**"Could not connect to Docker daemon"** — Docker Desktop isn't running. Start it from your applications menu, or install from [docker.com](https://docs.docker.com/get-docker/).

**"Port 3001 already in use"** — something else is on that port. Set `PORT=3002` in `docker-compose.yml` or run the local dev version with `PORT=3002 npm run dev:server`.

**"Cannot find module '@precious/core'"** (local dev) — you need to build the dependencies first: `npm run build:core && npm run build:db && npm run build:providers`.

**Wipe all data and start fresh:** `docker compose down -v && docker compose up -d`

---

## Why "Precious"?

Because like the One Ring, one key binds them all. Your `prec_` key rules every LLM you've ever added, routing through them with the precision of a fellowship navigating Middle-earth. The branding is intentionally playful — the engineering underneath is serious.

---

## License

MIT — use it, fork it, ship it, build a business on it. Just keep your API keys safe.

---

## Contributing

Issues, feature requests, and pull requests are welcome. Start with [SPEC.md](./SPEC.md) for the architectural decisions and [AGENTS.md](./AGENTS.md) for the contributor guide. The provider adapter pattern is designed to make adding new LLM providers straightforward — see `packages/providers/src/groq.ts` for a minimal example.
