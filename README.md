# Precious

> **One key to rule them all.**  
> *Every LLM. Your keys. Our router.*

**Precious Local** — self-hostable LLM router (MIT). Clone, run, add your provider keys, chat with Auto failover, use one `prec_` API key everywhere.

**Precious Cloud** (hosted signup) lives in the private `precious-cloud` repo — not included here.

## Quick start

```bash
git clone https://github.com/suv0/precious.git
cd precious
npm install
npm run build:core && npm run build:db && npm run build:providers

# Terminal 1 — API (port 3001)
npm run dev:server

# Terminal 2 — Panel UI (port 3000) — optional; Docker serves both on :3001
npm run dev:web
```

Open **http://localhost:3000/settings/keys** (or **http://localhost:3001** with Docker).

No login required — straight to the panel.

### Docker (API + panel on one port)

```bash
docker compose up --build
# http://localhost:3001/settings/keys
```

### Unified API key

```bash
curl http://localhost:3001/v1/chat/completions \
  -H "Authorization: Bearer prec_..." \
  -H "Content-Type: application/json" \
  -d '{"model":"auto","messages":[{"role":"user","content":"Hello"}]}'
```

Use `model: "auto"` to walk your fallback chain. On rate limit, Precious failovers with **full conversation context**.

## Architecture

```
packages/core/       Router, encryption, per-key rate limits
packages/providers/  Groq, Gemini, OpenRouter, Mistral, custom
packages/panel/      Shared chat + keys UI
packages/db/         Shared Drizzle schema
apps/server/         Local API (Hono + SQLite)
apps/web/            Thin panel shell (no marketing pages)
```

See [AGENTS.md](./AGENTS.md) for contributor/agent guide.

## Providers

**17 adapters** — Groq, Gemini, Cerebras, Cloudflare, GitHub Models, OpenRouter, Mistral, HuggingFace, Ollama Cloud, OpenCode Zen, Zhipu, LLM7, Cohere, NVIDIA NIM, Pollinations (keyless), Kilo (keyless), plus custom OpenAI-compatible (Ollama, LM Studio). Cloud mode exposes only `cloudSafe` providers. See [PROVIDERS_BACKLOG.md](./PROVIDERS_BACKLOG.md).

## Hosted cloud

Can't run locally? Use **Precious Cloud** (separate private deployment) — marketing site, GitHub signup, same panel in the browser.

## License

MIT
