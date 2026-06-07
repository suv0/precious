# Precious

> **One key to rule them all.**  
> *Every LLM. Your keys. Our router.*

Precious is an **open-core**, self-hostable personal AI workspace. This repository (MIT) ships the shared router engine, provider adapters, **Precious Local** API server, and Next.js UI for chat, keys, docs, and transparency pages.

**Hosted Precious Cloud** (signup, multi-tenant SaaS, Cloudflare Workers) is a separate **private** product and is not included here. Run locally or deploy the local stack yourself.

## Quick start — Local (recommended)

```bash
git clone https://github.com/suv0/precious.git
cd precious
npm install
npm run build:core && npm run build:providers

# Terminal 1 — API server (port 3001)
npm run dev:server

# Terminal 2 — Web UI (port 3000)
npm run dev:web
```

1. Open http://localhost:3000/settings/keys — **no login needed** in local mode  
2. Add Groq or OpenRouter key (accept ToS checkbox)  
3. Generate a `prec_` unified key for external tools, or chat directly in the UI  
4. Chat at http://localhost:3000/chat  

Optional: set `PRECIOUS_LOCAL_PASSWORD` on the server to require a password before API access.

### Docker

```bash
docker compose up --build
# API at http://localhost:3001/health
# For UI, run web separately or build static export (see apps/web README patterns)
```

Data persists in the `precious-data` volume. `ENCRYPTION_KEY` is auto-generated at `/data/.env.local` on first run — **back it up**.

**Windows note:** Local server uses `@libsql/client` (no Visual Studio / node-gyp required). If port 3001 is busy, set `PORT=3002`.

## Development

```bash
npm install
npm run build:core && npm run build:providers
npm run dev:server   # :3001
npm run dev:web      # :3000
```

Set `NEXT_PUBLIC_API_URL=http://localhost:3001` in `apps/web/.env.local` if rewrites fail.

## API (OpenAI-compatible)

```bash
curl http://localhost:3001/v1/chat/completions \
  -H "Authorization: Bearer prec_..." \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}],"stream":false}'

curl http://localhost:3001/v1/models -H "Authorization: Bearer prec_..."
```

Browser chat (local, no auth): `POST /api/chat/completions`. With `PRECIOUS_LOCAL_PASSWORD` set, login first for a session cookie.

## Architecture (this repo)

```
precious/
├── packages/core/       Router, encryption, rate limits, types
├── packages/providers/  Groq, Gemini, OpenRouter, Mistral, OpenAI-compat
├── apps/web/            Next.js 15 — marketing, chat, settings, docs
├── apps/server/         Precious Local — Hono + SQLite
└── docker-compose.yml   Local API container
```

## Providers

| Provider | Local | Risk |
|----------|-------|------|
| Groq | Yes | Low |
| Google Gemini | Yes | Medium |
| OpenRouter | Yes | Medium |
| Mistral | Yes | Low |
| Custom OpenAI-compat | Yes | Medium |

See `/docs` for key setup guides and `/legal` for ToS risk details.

## Honest limitations

1. **Provider limits** — each upstream free tier (RPM, daily tokens). Precious failovers when you hit them.
2. **Local mode** — only provider limits apply; no shared cloud infra cap.

> Built for hobby scale and self-hosting. Dozens of daily users on your own machine or VPS.

## Open-core model

- **Public (this repo):** MIT — core, providers, local server, web UI for self-host.
- **Private:** Hosted multi-tenant cloud layer is maintained separately and is not open source.

## Security

- AES-256-GCM encryption for provider keys at rest  
- bcrypt hash for unified `prec_` keys (show once)  
- Tenant scoping on all queries  
- Audit log for key access  
- No keys in logs  

Read `/security`, `/privacy`, `/legal`.

## License

MIT — see [LICENSE](./LICENSE).
