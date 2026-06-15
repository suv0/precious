# Precious — Specification

Living document of architectural decisions, feature requirements, and design rationale. See [AGENTS.md](./AGENTS.md) for contributor guide, [taste file](.commandcode/taste/taste.md) for learned preferences, and [README.md](./README.md) for quick start.

---

## Data Flow Architecture

### Chat Request (Panel Mode)

```
Browser (useChat + streamProtocol: 'text')
    │  POST /api/chat/completions
    ▼
Apps/Server (Hono + SQLite) — chat.ts
    │  Decrypt keys, load chain, call Router
    ▼
@precious/core Router — router.ts
    │  Sticky session → chain walk → adapter call
    ▼
@precious/providers Adapter — e.g., gemini.ts
    │  fetch() to upstream provider
    ▼
Upstream LLM (Google Gemini, Groq, etc.)
    │  SSE stream or JSON response
    ▼
Server wraps in sseToPlainText → text stream → browser
    │  On mid-stream error: router.streamFailed() → router.route() retry (non-streaming)
    ▼
Browser receives text (original or retry response)
```

### Failover Flow

1. Router tries sticky session (last successful provider/key, 30min TTL)
2. If sticky fails or absent → walk `fallback_chain` (ordered by priority)
3. For each chain entry (`providerId` + `model`), iterate all keys for that provider
4. Skip keys on cooldown (30s), unhealthy, or missing
5. Skip entries with no keys or unknown adapters
6. On retryable error (429, 5xx, timeout) → set 30s cooldown → next key/provider
7. On non-retryable error (401, 403, etc.) → throw immediately
8. On success → set sticky session → return result
9. If all exhausted → throw `"All providers exhausted after N attempts"`

### Streaming Error Handling

**HTTP-level errors (non-2xx):** Caught by adapter's `streamChatCompletion` before first yield. Router sees the error and triggers failover.

**Mid-stream errors (provider returns 200, then errors mid-generation):**
- `streamOpenAIResponse` / adapter generators: pass error chunks through as SSE (no error detection)
- `sseToPlainText` (panel mode): detects `parsed.error`, throws
- Server stream callback catches the error:
  1. Calls `router.streamFailed()` — clears sticky session AND sets 30s cooldown on the failed key
  2. Calls `router.route()` again with `stream: false` (non-streaming retry)
  3. Router skips the cooldown'd key and tries the next provider with full conversation context
  4. Retry response is written as plain text to the client
  5. If retry also fails, the original error message is shown
- `interceptSSEUsage` (API mode): passes everything through verbatim (client must handle errors)

**Router.streamFailed(userId, providerId, model, keyId):**
- Clears sticky session for that user
- Sets 30s cooldown on `providerId:model:keyId`
- Next `router.route()` call for this user will walk the chain skipping the failed key

**KEY INVARIANT:** Mid-stream errors are not retried by the Router. Once a stream is returned from `route()`, the Router considers the attempt successful. There is no circuit-breaker for mid-stream failures. This is a known gap — see "Open Issues" below.

### Context on Failover

The Router sends the **full `messages[]` array** to every retry. This means:
- Previous conversation context is preserved across failover
- No tool-call result loss
- Non-streaming mode: browser sends full history. Streaming mode: server appends assistant response to conversation before next request.

---

## Sticky Sessions

| Property | Value |
|----------|-------|
| Key | `Router.stickySessions` Map, keyed by `userId` |
| Duration | 30 minutes |
| What's stored | `{ providerId, model, keyId, pinnedUntil }` |
| On success | Timestamp refreshed for another 30 min |
| On failure | Session deleted, **but no cooldown set** (BUG: see Open Issues) |
| Effect | Next `route()` call tries sticky first, before chain walk |

### Cooldown

| Property | Value |
|----------|-------|
| Duration | 30 seconds |
| Key format | `${providerId}:${model}:${keyId}` |
| Set on | Any retryable error (429, 5xx, timeout) in chain walk |
| NOT set on | Sticky session failure (BUG), health check failures |
| Scope | In-memory, per-Router-instance |

---

## Fallback Chain

### Schema (`fallback_chain` table)

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT | UUID |
| user_id | TEXT | FK → users |
| provider_id | TEXT | Provider identifier |
| model | TEXT | Model name |
| priority | INTEGER | Lower = tried first |
| enabled | BOOLEAN | Can be toggled off |

### Chain Building (`ensureFallbackChainForKeys`)

- Iterates all `provider_keys` for the user
- For each unique `providerId`, inserts ONE chain entry with `getDefaultModels(providerId)[0]`
- **BUG:** Only the first default model is added. A user with only Gemini gets `gemini-2.5-flash` but not `gemini-2.5-flash-lite`. 
- If a provider disappears from keys, its chain entry persists (must be manually cleaned)
- Priority auto-increments from last existing priority

### Default Models per Provider

| Provider | Default Models |
|----------|---------------|
| `groq` | llama-3.3-70b-versatile, llama-3.1-8b-instant |
| `google-gemini` | gemini-2.5-flash, gemini-2.5-flash-lite |
| `openai` | gpt-4o-mini, gpt-4o |
| `cerebras` | gpt-oss-120b, zai-glm-4.7 |
| `cloudflare` | @cf/moonshotai/kimi-k2.6, @cf/zai-org/glm-4.7-flash, @cf/meta/llama-3.1-8b-instruct |
| `github-models` | openai/gpt-4.1, openai/gpt-4o, openai/gpt-4o-mini |
| `openrouter` | meta-llama/llama-3.3-70b-instruct:free |
| `mistral` | mistral-small-latest |
| `huggingface` | deepseek-ai/DeepSeek-V3, moonshotai/Kimi-K2-Instruct |
| `ollama-cloud` | glm-4.7, kimi-k2 |
| `opencode` | deepseek-v4-flash |
| `zhipu` | glm-4-flash, glm-4.5-flash |
| `llm7` | gpt-oss-20b, llama-3.1-turbo |
| `cohere` | command-r-plus-08-2024 |
| `nvidia` | meta/llama-3.1-70b-instruct |
| `pollinations` | openai-fast |
| `kilo` | kilo/free |
| `openai-compat` | llama3.2 |

---

## Audit Trails

### `audit_log` table

Every significant action is logged with:
- `action`: Type (e.g., `chat_request`, `key_added`, `key_deleted`)
- `resourceType`, `resourceId`: What was affected
- `metadata`: JSON blob with context (provider, model, attempts, tokens, error, etc.)
- Keys and secrets are **stripped** from metadata via `sanitizeMetadata`

### Chat request audit (streaming panel mode)

**Deferred logging:** The initial `logAudit` call is **skipped** for streaming panel requests because the first Router result may fail mid-stream and trigger a retry to a different provider. Instead, a single comprehensive audit entry is logged once the stream completes.

**Metadata fields:**
- `provider`, `model`: Final provider that delivered the response
- `failoverFrom`: Previous provider if failover occurred
- `attempts`: Total routing attempts (includes retry)
- `tokens`: Total tokens used
- `stream`: Always `true` for streaming panel
- `streamFailed`: `true` if the initial stream hit a mid-stream error and was retried
- `streamFailedProvider`, `streamFailedModel`: Which provider/model failed mid-stream
- `streamError`: The error message from the mid-stream failure (e.g., "Gemini error 429: rate limit or quota exceeded")
- `routeTrail`: Full array of routing attempts with results

**Audit page display:** Shows `google-gemini ✗ → groq · llama-3.3-70b-versatile` for stream retries, with detail line including failover source and error.

---

## Gemini-Specific

### Model Remapping

In `apps/server/src/routes/chat.ts`, deprecated/lower-tier models are auto-remapped:

| From | To |
|------|----|
| gemini-2.0-flash | gemini-2.5-flash |
| gemini-1.5-flash | gemini-2.5-flash |
| gemini-1.5-pro | gemini-2.5-flash |

This applies to chain entries loaded via `loadUserContext`. The chain DB row is not modified — the remap is in-memory.

### Rate Limit Detection

- `limit: 0` in error message → "This model is not on your free tier" (different UX message)
- Standard 429 → "Rate limit reached" with hint to add Groq key
- `formatChatError()` in panel has special handling for these patterns

---

## API Modes

### Panel Mode (`useStoredMessages = true`)
- Browser uses `useChat` with `streamProtocol: 'text'`
- Server wraps SSE in `sseToPlainText` → text/plain response
- Messages stored in SQLite (`chat_messages` table)
- Auto-creates conversations, auto-titles from first message
- Conversation history loaded via `/api/chat/messages?conversationId=`

### API Mode (`useStoredMessages = false`)
- External clients use standard OpenAI-compatible `/v1/chat/completions`
- Full SSE passthrough via `interceptSSEUsage`
- API keys stored separately, not tied to conversations
- Messages optionally saved if `conversationId` is provided

---

## Rate Limiting

| Limiter | Scope | Rate |
|---------|-------|------|
| `accountRateLimiter` | Panel chat | 60 req/min per user |
| `apiRateLimiter` | API chat/embeddings | 120 req/min per key |

Provider-level rate limits are detected from response headers (`extractRateLimitHeaders`) and displayed in the `QuotaCapacityBar` component.

---

## Error Display (Panel UI)

### `ChatErrorBanner` + `formatChatError`

Raw error messages are parsed and categorized:
- `"All providers exhausted..."` → Friendly message with per-provider breakdown
- 429 / quota → Rate limit message with hints
- 401 / invalid key → Key validation message
- `"No models configured"` → Add keys prompt
- Everything else → `"Could not get a reply"` (generic fallback)

### Callback Guard (ChatPage.tsx)

`chatErrorRef` prevents the `onFinish` callback from overwriting errors set by `onResponse` or `onError`. On retry/submit, the ref is cleared.

---

## Open Issues

### MID-STREAM FAILOVER (FIXED 2026-06-15)

**Problem:** Mid-stream provider errors were not retried. Once `route()` returned a stream, it was treated as success. If the stream later failed, the user got a broken message and had to manually retry.

**Fix:** The panel stream callback now catches mid-stream errors, calls `router.streamFailed()` to clear sticky + set cooldown, then re-calls `router.route()` with `stream: false` for a non-streaming retry through the next provider. Full conversation context is preserved. Retry results (provider, model, tokens) are audited with `retry: true`.

### STICKY SESSION NO-COOLDOWN BUG (FIXED 2026-06-15)

**Problem:** When a sticky session fails, `this.stickySessions.delete()` was called but `this.setCooldown()` was NOT called. The chain walk then immediately tried the same provider/key again.

**Fix:** Added `this.setCooldown(cdKey, Date.now())` after `this.stickySessions.delete()` in the sticky catch block. Now the chain walk skips the failed key for 30 seconds and proceeds to the next provider.

### SINGLE MODEL PER PROVIDER IN CHAIN (FIXED 2026-06-15)

**Problem:** `ensureFallbackChainForKeys` added only `getDefaultModels(providerId)[0]` per provider. A user with only Gemini got `gemini-2.5-flash` but couldn't failover to `gemini-2.5-flash-lite`.

**Fix:** Now iterates ALL default models per provider and adds a chain entry for each. Deduplication uses `providerId:model` as the key (not just `providerId`).

### NO MID-STREAM ERROR IN AUDIT TRAIL (MEDIUM)

**Problem:** When `sseToPlainText` throws mid-stream, the error is caught and written as text to the client, but the audit trail only shows the initial routing success (provider, model, 0 tokens if no text was generated). The error is not recorded.

---

## Revision History

| Date | What Changed |
|------|-------------|
| 2026-06-15 | Added `sseToPlainText` and stream retry tests (server-side). Exported `sseToPlainText` for testing. QuotaCapacityBar label changed from "Routing budget" to "Token budgets" for clarity. Audit trail: deferred streaming audit until stream completes with full retry metadata (streamFailed, routeTrail). |
| 2026-06-15 | Fixed sticky session cooldown bug (was not cooling down on sticky failure, causing same key to retry). Fixed chain builder to include ALL default models per provider, not just the first. Added mid-stream failover: catch → streamFailed() → route() retry with full context.
| 2026-06-15 | Initial version. Captured all known architecture, open issues. |
