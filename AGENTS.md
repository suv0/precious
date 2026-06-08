# Precious — Agent Guide

Single source of truth for humans and AI agents working on this codebase.

## Mission

**Precious** is a BYOK LLM router: users bring their own provider API keys; Precious routes chat and API requests with automatic failover when rate limits hit. **Full conversation context is always forwarded** on failover.

> One key to rule them all. Every LLM. Your keys. Our router.

## Two products

| | **Precious Local** (this public MIT repo) | **Precious Cloud** (private `precious-cloud/`) |
|---|---|---|
| **Audience** | Power users — clone & run Docker/npm | Non-technical users — signup on website |
| **Auth** | None — single implicit user | Signup/login required |
| **UI** | Panel only (`/chat`, `/settings/keys`) | Marketing + auth + same panel |
| **Providers** | Full catalog (expand over time) | Curated `cloudSafe` providers only |
| **License** | MIT | Proprietary |

## Repo map

```
precious/                          ← public MIT monorepo
├── packages/core/                 Router, encryption, rate limits, API keys
├── packages/providers/            LLM adapters (Groq, Gemini, OpenRouter, …)
├── packages/panel/                Shared chat + keys UI (MIT, utilitarian)
├── apps/server/                   Precious Local — Hono + SQLite
├── apps/web/                      Thin shell — panel routes only
├── AGENTS.md                      This file
└── docker-compose.yml

precious-cloud/                    ← private proprietary repo
├── apps/worker/                   Cloudflare Workers API (multi-tenant)
└── apps/web/                      Marketing, auth, transparency, panel shell
```

## Architecture invariants

1. **One engine** — `@precious/core` and `@precious/providers` live in public repo only. Cloud imports via `file:../../precious/packages/...`. Never duplicate router or adapter code in cloud.
2. **Context on failover** — Router sends full `messages[]` to each retry. Browser chat persists history in SQLite.
3. **No pooled keys** — Each user brings their own upstream keys. We never share provider keys between users.
4. **Tenant scoping** — Every DB query in cloud mode: `WHERE user_id = ?`.
5. **Encrypted at rest** — Provider keys: AES-256-GCM. Unified keys: bcrypt hash, show once (`prec_` prefix).
6. **Marketing stays private** — Landing pages, signup, transparency site → `precious-cloud/apps/web` only.

## Where to edit what

| Change | Location |
|--------|----------|
| Router, failover, encryption | `packages/core` |
| New LLM provider | `packages/providers` |
| Chat/keys UI | `packages/panel` |
| Local API routes | `apps/server` |
| Local web shell | `apps/web` |
| Cloud API | `precious-cloud/apps/worker` |
| Marketing, auth, signup | `precious-cloud/apps/web` |

After engine or panel changes: `cd precious-cloud && npm run build:deps`

## Brand voice (private marketing + shared micro-copy)

| Element | Direction |
|---------|-----------|
| **Vibe** | Warm, playful, fantasy-adjacent — not corporate SaaS gray |
| **Colors** | Deep emerald + gold accents |
| **Panel UI** | Chat-first; keys/settings secondary |
| **Avoid** | Default shadcn admin-dashboard clone look |

### Hero copy (cloud marketing)

- **Primary:** One key to rule them all.
- **Sub:** Every LLM. Your keys. Our router.
- **Unified key prefix:** `prec_`

### Micro-copy

| Line | Where |
|------|-------|
| My precious tokens. | Empty chat state |
| Second breakfast? Second fallback provider. | Rate-limit / failover toast |
| You shall not pass… without a valid API key. | 401 errors |
| Keeping it safe, yesss. | Key added confirmation |
| One does not simply forge a Ring with an empty vault. | Unified key blocked (no provider keys) |
| A Ring without a bearer goes nowhere. | Unified key section warning |
| Your prec_ key is forged. Guard it — unlike certain hobbits, you only see it once. | Unified key generated |
| The fellowship order is set. Failover shall follow your command. | Fallback chain saved |
| The palantír has spoken. Key health updated. | Health check complete |
| No keys in the vault — chat cannot leave the Shire… | Chat with no provider keys |

### Product positioning

**Say:** Personal AI desk, BYOK, cloud or local, honest about tradeoffs.

**Never say:** "Free unlimited AI", "Replace OpenAI", "Production enterprise gateway".

## Free hosting constraints (cloud)

| Layer | Service | Free tier |
|-------|---------|-----------|
| Frontend | Vercel Hobby | 100 GB/mo, no card |
| API | Cloudflare Workers | 100k requests/day |
| Database | Turso | SQLite-compatible |
| Rate limits | Cloudflare KV | 100k reads/day |

**Avoid:** Fly.io, Render, Oracle Cloud (often require credit card).

**Three limit types** (document on cloud `/limitations`):

1. **Provider limits** — user's own free tier (Gemini RPM, etc.)
2. **Infra limit** — ~100k Worker requests/day **across all users**
3. **Abuse cap** — ~60 req/min per account on cloud

## Security launch checklist (cloud)

- [x] AES-256-GCM provider keys
- [x] Unified keys bcrypt-hashed
- [x] Tenant scoping, audit log, no keys in logs
- [ ] Account delete cascade
- [ ] Signup anti-abuse (GitHub OAuth + rate limit)
- [ ] Dependency audit in CI
- [ ] Separate chat vs API rate limits on cloud

## Provider expansion backlog

Implement new adapters in `packages/providers` using each vendor's official API docs. Mark `cloudSafe: false` for local-only providers.

| Provider | Priority | cloudSafe |
|----------|----------|-----------|
| Cerebras | High | true |
| Cloudflare Workers AI | High | true |
| GitHub Models | High | true |
| HuggingFace | Medium | true |
| Cohere | Medium | false (ToS) |
| NVIDIA NIM | Low | false |
| Z.ai / Zhipu | Medium | partial |
| Ollama Cloud | Medium | true |
| Pollinations, LLM7, Kilo | Medium | false |
| OpenCode Zen | Low | true |

Current shipped: Groq, Google Gemini, OpenRouter, Mistral, OpenAI-compat (custom).

## What NOT to do

- Do not commit secrets (`ENCRYPTION_KEY`, `AUTH_SECRET`, `DATABASE_URL`)
- Do not put marketing/landing pages in the public MIT repo
- Do not duplicate router logic in `precious-cloud`

## Development

```bash
cd precious
npm install
npm run build:core && npm run build:providers && npm run build:panel
npm run dev:server   # :3001
npm run dev:web      # :3000
npm test             # core router tests
```

```bash
cd precious-cloud
npm run build:deps
npm run dev          # wrangler dev
npm run dev:web      # cloud marketing + panel :3000
```
