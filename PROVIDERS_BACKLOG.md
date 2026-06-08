# Provider expansion backlog

See [AGENTS.md](./AGENTS.md) for the full list. Add each adapter in `packages/providers` following the vendor's official API.

## Priority order

1. Cerebras
2. Cloudflare Workers AI
3. GitHub Models
4. HuggingFace
5. Ollama Cloud
6. Z.ai / Zhipu
7. Pollinations, LLM7, Kilo (local-only / anon)
8. OpenCode Zen
9. Cohere, NVIDIA NIM (local-only — ToS)

## Per provider checklist

- [ ] Add adapter in `packages/providers/src/`
- [ ] Register in `registry.ts` with `cloudSafe` flag
- [ ] Default models in `getDefaultModels()`
- [ ] ToS risk level in provider meta
- [ ] Key setup doc (cloud web `/docs` or README)
