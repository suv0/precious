import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  FallbackChainEntry,
  ProviderId,
  RouteAttempt,
  RouterContext,
} from './types.js';

export interface ProviderAdapter {
  id: ProviderId;
  chatCompletion(
    apiKey: string,
    model: string,
    request: ChatCompletionRequest,
    baseUrl?: string | null,
  ): Promise<ChatCompletionResponse>;
  streamChatCompletion(
    apiKey: string,
    model: string,
    request: ChatCompletionRequest,
    baseUrl?: string | null,
  ): AsyncGenerator<string, void, unknown>;
  embedding?(
    apiKey: string,
    model: string,
    request: EmbeddingRequest,
    baseUrl?: string | null,
  ): Promise<EmbeddingResponse>;
}

export interface RouterResult {
  response?: ChatCompletionResponse;
  stream?: AsyncGenerator<string, void, unknown>;
  provider: ProviderId;
  model: string;
  attempts: number;
  failoverFrom?: ProviderId;
  trail?: RouteAttempt[];
}

const DEFAULT_MAX_ATTEMPTS = 20;
const COOLDOWN_MS = 30_000;
const STICKY_DURATION_MS = 30 * 60 * 1000;

interface StickySession {
  providerId: ProviderId;
  model: string;
  keyId: string;
  pinnedUntil: number;
}

interface CooldownState {
  until: number;
}

export class Router {
  private adapters: Map<ProviderId, ProviderAdapter>;
  private cooldowns = new Map<string, CooldownState>();
  private capsCheck: ((providerId: ProviderId, model: string) => { images: boolean; documents: boolean }) | null = null;
  private stickySessions = new Map<string, StickySession>();

  constructor(
    adapters: ProviderAdapter[],
    capsCheck?: (providerId: ProviderId, model: string) => { images: boolean; documents: boolean },
  ) {
    this.adapters = new Map(adapters.map((a) => [a.id, a]));
    this.capsCheck = capsCheck ?? null;
  }

  private cooldownKey(providerId: ProviderId, model: string, keyId: string): string {
    return `${providerId}:${model}:${keyId}`;
  }

  private isOnCooldown(key: string, now: number): boolean {
    const state = this.cooldowns.get(key);
    return state !== undefined && state.until > now;
  }

  private setCooldown(key: string, now: number): void {
    this.cooldowns.set(key, { until: now + COOLDOWN_MS });
  }

  private shouldRetry(error: unknown): boolean {
    if (error instanceof RouterError) {
      return error.retryable;
    }
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('429') || msg.includes('rate limit')) return true;
      if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504')) return true;
      if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('econnreset')) return true;
    }
    return false;
  }

  private getOrderedChain(chain: FallbackChainEntry[]): FallbackChainEntry[] {
    return [...chain]
      .filter((e) => e.enabled)
      .sort((a, b) => a.priority - b.priority);
  }

  /** Auto walks the full chain; a pinned model uses only that entry (backup keys for same provider still rotate). */
  private getChainToTry(
    chain: FallbackChainEntry[],
    pinnedModel?: string,
    pinnedProvider?: ProviderId,
    attachmentFilter?: { needsImages: boolean; needsDocuments: boolean },
  ): FallbackChainEntry[] {
    const ordered = this.getOrderedChain(chain);
    let filtered = ordered;

    if (attachmentFilter && this.capsCheck) {
      const { needsImages, needsDocuments } = attachmentFilter;
      filtered = filtered.filter((entry) => {
        const caps = this.capsCheck!(entry.providerId, entry.model);
        if (needsImages && !caps.images) return false;
        if (needsDocuments && !caps.documents) return false;
        return true;
      });

      if (filtered.length === 0) {
        throw new RouterError(
          'No provider in your fallback chain supports the requested attachments. Add a vision-capable model (e.g. Gemini, GPT-4o) to your chain.',
          false,
        );
      }
    }

    if (!pinnedModel || pinnedModel === 'auto') return filtered;

    const pinnedIdx = ordered.findIndex((e) => {
      if (pinnedProvider) {
        return e.providerId === pinnedProvider && e.model === pinnedModel;
      }
      return e.model === pinnedModel;
    });

    if (pinnedIdx >= 0) {
      return [ordered[pinnedIdx]!];
    }

    if (pinnedProvider) {
      return [
        {
          providerId: pinnedProvider,
          model: pinnedModel,
          priority: 0,
          enabled: true,
        },
      ];
    }

    const sameModel = ordered.filter((e) => e.model === pinnedModel);
    return sameModel;
  }

  private freezeRequest(request: ChatCompletionRequest): ChatCompletionRequest {
    return {
      ...request,
      messages: request.messages.map((m) => ({ ...m })),
    };
  }

  async route(
    ctx: RouterContext,
    request: ChatCompletionRequest,
    stream = false,
  ): Promise<RouterResult> {
    const maxAttempts = ctx.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    const fullRequest = this.freezeRequest(request);
    const attachmentFilter = fullRequest.hasAttachments && fullRequest.attachmentTypes?.length
      ? {
          needsImages: fullRequest.attachmentTypes.includes('image'),
          needsDocuments: fullRequest.attachmentTypes.includes('document'),
        }
      : undefined;
    const chainToTry = this.getChainToTry(
      ctx.fallbackChain,
      fullRequest.model,
      fullRequest.providerId,
      attachmentFilter,
    );

    if (chainToTry.length === 0) {
      throw new RouterError('No models configured in fallback chain', false);
    }

    // Sticky session — try the last successful provider/model/key first
    const sticky = this.stickySessions.get(ctx.userId);
    if (sticky && sticky.pinnedUntil > Date.now()) {
      const stickyEntry = chainToTry.find(
        (e) => e.providerId === sticky.providerId && e.model === sticky.model,
      );
      if (stickyEntry) {
        const adapter = this.adapters.get(stickyEntry.providerId);
        const keyRecord = ctx.providerKeys.find(
          (k) => k.id === sticky.keyId && k.providerId === sticky.providerId,
        );
        const cdKey = this.cooldownKey(sticky.providerId, sticky.model, sticky.keyId);
        const now = Date.now();

        if (
          adapter &&
          keyRecord &&
          !this.isOnCooldown(cdKey, now) &&
          (!ctx.isKeyAvailable || ctx.isKeyAvailable(sticky.providerId, sticky.model, sticky.keyId))
        ) {
          try {
            const apiKey = ctx.decryptKey(keyRecord.encryptedKey);
            const providerRequest: ChatCompletionRequest = {
              ...fullRequest,
              model: sticky.model,
              stream,
            };

            if (stream) {
              const gen = adapter.streamChatCompletion(apiKey, sticky.model, providerRequest, keyRecord.customBaseUrl);
              // Refresh sticky timestamp on success
              this.stickySessions.set(ctx.userId, { ...sticky, pinnedUntil: Date.now() + STICKY_DURATION_MS });
              return {
                stream: gen,
                provider: sticky.providerId,
                model: sticky.model,
                attempts: 1,
                trail: [{ provider: sticky.providerId, model: sticky.model, result: 'success' }],
              };
            }

            const response = await adapter.chatCompletion(apiKey, sticky.model, providerRequest, keyRecord.customBaseUrl);
            this.stickySessions.set(ctx.userId, { ...sticky, pinnedUntil: Date.now() + STICKY_DURATION_MS });
            return {
              response: {
                ...response,
                precious: { provider: sticky.providerId, model: sticky.model, attempts: 1, routeTrail: [{ provider: sticky.providerId, model: sticky.model, result: 'success' }] },
              },
              provider: sticky.providerId,
              model: sticky.model,
              attempts: 1,
              trail: [{ provider: sticky.providerId, model: sticky.model, result: 'success' }],
            };
          } catch {
            // Sticky session failed — clear and fall through
            this.stickySessions.delete(ctx.userId);
          }
        } else {
          this.stickySessions.delete(ctx.userId);
        }
      } else {
        this.stickySessions.delete(ctx.userId);
      }
    }

    let attempts = 0;
    const now = Date.now();
    const errors: string[] = [];
    const trail: RouteAttempt[] = [];
    let lastFailedProvider: ProviderId | undefined;
    const pinBypassHealth = Boolean(fullRequest.providerId);

    for (const entry of chainToTry) {
      const adapter = this.adapters.get(entry.providerId);
      if (!adapter) {
        errors.push(`Unknown provider: ${entry.providerId}`);
        trail.push({ provider: entry.providerId, model: entry.model, result: 'skipped', skipped: 'Unknown provider' });
        continue;
      }

      const keys = ctx.providerKeys.filter((k) => k.providerId === entry.providerId);
      if (keys.length === 0) {
        errors.push(`No key for provider: ${entry.providerId}`);
        trail.push({ provider: entry.providerId, model: entry.model, result: 'skipped', skipped: 'No key configured' });
        continue;
      }

      for (const keyRecord of keys) {
        const model = entry.model;
        const cdKey = this.cooldownKey(entry.providerId, model, keyRecord.id);
        if (this.isOnCooldown(cdKey, now)) {
          errors.push(`${entry.providerId}/${model}: cooling down after a recent error`);
          trail.push({ provider: entry.providerId, model, result: 'skipped', skipped: 'Cooldown (recent error)' });
          continue;
        }
        if (
          ctx.isKeyAvailable &&
          !pinBypassHealth &&
          !ctx.isKeyAvailable(entry.providerId, model, keyRecord.id)
        ) {
          errors.push(
            `${entry.providerId}/${model}: skipped (health check flagged this key — re-test in Keys)`,
          );
          trail.push({ provider: entry.providerId, model, result: 'skipped', skipped: 'Unhealthy (test in Keys)' });
          continue;
        }

        while (attempts < maxAttempts) {
          attempts += 1;
          try {
            const apiKey = ctx.decryptKey(keyRecord.encryptedKey);
            const providerRequest: ChatCompletionRequest = {
              ...fullRequest,
              model,
              stream,
            };

            if (stream) {
              const gen = adapter.streamChatCompletion(
                apiKey,
                model,
                providerRequest,
                keyRecord.customBaseUrl,
              );
              this.stickySessions.set(ctx.userId, {
                providerId: entry.providerId,
                model,
                keyId: keyRecord.id,
                pinnedUntil: Date.now() + STICKY_DURATION_MS,
              });
              trail.push({ provider: entry.providerId, model, result: 'success' });
              return {
                stream: gen,
                provider: entry.providerId,
                model,
                attempts,
                failoverFrom: lastFailedProvider,
                trail,
              };
            }

            const response = await adapter.chatCompletion(
              apiKey,
              model,
              providerRequest,
              keyRecord.customBaseUrl,
            );

            this.stickySessions.set(ctx.userId, {
              providerId: entry.providerId,
              model,
              keyId: keyRecord.id,
              pinnedUntil: Date.now() + STICKY_DURATION_MS,
            });

            trail.push({ provider: entry.providerId, model, result: 'success' });
            return {
              response: {
                ...response,
                precious: {
                  provider: entry.providerId,
                  model,
                  attempts,
                  failoverFrom: lastFailedProvider,
                  routeTrail: trail,
                },
              },
              provider: entry.providerId,
              model,
              attempts,
              failoverFrom: lastFailedProvider,
              trail,
            };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`${entry.providerId}/${model}: ${msg}`);
            trail.push({ provider: entry.providerId, model, result: 'error', error: msg.slice(0, 120) });

            if (this.shouldRetry(err)) {
              lastFailedProvider = entry.providerId;
              this.setCooldown(cdKey, Date.now());
              break;
            }
            throw err instanceof RouterError
              ? err
              : new RouterError(msg, false);
          }
        }
      }
    }

    throw new RouterError(
      `All providers exhausted after ${attempts} attempts. ${errors.join('; ')}`,
      false,
    );
  }

  async routeEmbedding(
    ctx: RouterContext,
    request: EmbeddingRequest,
  ): Promise<{ response: EmbeddingResponse; provider: ProviderId; model: string; attempts: number; failoverFrom?: ProviderId }> {
    const maxAttempts = ctx.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    const chainToTry = this.getChainToTry(
      ctx.fallbackChain,
      request.model,
      request.providerId,
    );

    if (chainToTry.length === 0) {
      throw new RouterError('No models configured in fallback chain', false);
    }

    let attempts = 0;
    const now = Date.now();
    const errors: string[] = [];
    let lastFailedProvider: ProviderId | undefined;

    for (const entry of chainToTry) {
      const adapter = this.adapters.get(entry.providerId);
      if (!adapter || !adapter.embedding) {
        errors.push(`${entry.providerId}: no embedding support`);
        continue;
      }

      const keys = ctx.providerKeys.filter((k) => k.providerId === entry.providerId);
      if (keys.length === 0) {
        errors.push(`No key for provider: ${entry.providerId}`);
        continue;
      }

      for (const keyRecord of keys) {
        const model = entry.model;
        const cdKey = this.cooldownKey(entry.providerId, model, keyRecord.id);
        if (this.isOnCooldown(cdKey, now)) {
          errors.push(`${entry.providerId}/${model}: cooling down after a recent error`);
          continue;
        }
        if (
          ctx.isKeyAvailable &&
          !ctx.isKeyAvailable(entry.providerId, model, keyRecord.id)
        ) {
          errors.push(
            `${entry.providerId}/${model}: skipped (health check flagged this key)`,
          );
          continue;
        }

        while (attempts < maxAttempts) {
          attempts += 1;
          try {
            const apiKey = ctx.decryptKey(keyRecord.encryptedKey);
            const response = await adapter.embedding(
              apiKey,
              model,
              request,
              keyRecord.customBaseUrl,
            );

            return {
              response: {
                ...response,
                precious: {
                  provider: entry.providerId,
                  model,
                  attempts,
                  failoverFrom: lastFailedProvider,
                },
              },
              provider: entry.providerId,
              model,
              attempts,
              failoverFrom: lastFailedProvider,
            };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`${entry.providerId}/${model}: ${msg}`);

            if (this.shouldRetry(err)) {
              lastFailedProvider = entry.providerId;
              this.setCooldown(cdKey, Date.now());
              break;
            }
            throw err instanceof RouterError
              ? err
              : new RouterError(msg, false);
          }
        }
      }
    }

    throw new RouterError(
      `All providers exhausted after ${attempts} attempts. ${errors.join('; ')}`,
      false,
    );
  }
}

export class RouterError extends Error {
  retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = 'RouterError';
    this.retryable = retryable;
  }
}
