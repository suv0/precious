# Provider expansion backlog

See [AGENTS.md](./AGENTS.md) for product context. Adapters live in `packages/providers/src/`.

## Shipped (local + cloud where `cloudSafe`)

| Provider | ID | cloudSafe | Notes |
|----------|-----|-----------|-------|
| Groq | `groq` | yes | |
| Google Gemini | `google-gemini` | yes | |
| Cerebras | `cerebras` | yes | Added 2026-06 |
| Cloudflare Workers AI | `cloudflare` | yes | Key format `account_id:token` |
| GitHub Models | `github-models` | yes | Added 2026-06 |
| OpenRouter | `openrouter` | yes | |
| Mistral | `mistral` | yes | |
| OpenAI | `openai` | yes | Added 2026-06 |
| HuggingFace Router | `huggingface` | yes | Added 2026-06 |
| Ollama Cloud | `ollama-cloud` | yes | Added 2026-06 |
| OpenCode Zen | `opencode` | yes | Added 2026-06 |
| Custom OpenAI-compatible | `openai-compat` | no | Ollama, LM Studio, vLLM |

## Shipped (local-only — `cloudSafe: false`)

| Provider | ID | Notes |
|----------|-----|-------|
| Z.ai (Zhipu) | `zhipu` | Added 2026-06 |
| LLM7 | `llm7` | Added 2026-06 |
| Cohere | `cohere` | ToS risk — personal use restricted |
| NVIDIA NIM | `nvidia` | Evaluation-only ToS |
| Pollinations | `pollinations` | Keyless anonymous tier |
| Kilo Gateway | `kilo` | Keyless `:free` routes |

## Deferred (FreeLLMAPI parity gaps)

| Provider | Reason |
|----------|--------|
| SambaNova | Free tier permanently retired (402 after trial credit) |
| Moonshot / MiniMax direct | Dropped from FreeLLMAPI; use OpenRouter/HF routes |
| Chutes | Requires non-zero balance despite “free” label |
| Embeddings routing | FreeLLMAPI has `/v1/embeddings` with family-based failover — not in Precious yet |
| Tool-call translation | FreeLLMAPI normalizes Gemini tool format; Precious passes through OpenAI shape only |
| Per-model RPM/RPD/TPM ledger | FreeLLMAPI tracks per `(platform, model, key)` caps; Precious has per-key health + account rate limits |
| Sticky sessions | FreeLLMAPI pins model for 30 min; Precious re-evaluates chain each request |
| Vision-only auto routing | FreeLLMAPI returns 422 when no vision model; Precious does not filter chain by attachments yet |

## Per provider checklist

- [x] Adapter in `packages/providers/src/`
- [x] Register in `registry.ts` with `cloudSafe`
- [x] Default models in `getDefaultModels()`
- [x] Vision rules in `vision.ts` where applicable
- [ ] Key setup doc page (cloud web `/docs`) — optional
