import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  FallbackChainEntry,
  ProviderId,
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
}

export interface RouterResult {
  response?: ChatCompletionResponse;
  stream?: AsyncGenerator<string, void, unknown>;
  provider: ProviderId;
  model: string;
  attempts: number;
  failoverFrom?: ProviderId;
}

const DEFAULT_MAX_ATTEMPTS = 20;
const COOLDOWN_MS = 30_000;

interface CooldownState {
  until: number;
}

export class Router {
  private adapters: Map<ProviderId, ProviderAdapter>;
  private cooldowns = new Map<string, CooldownState>();

  constructor(adapters: ProviderAdapter[]) {
    this.adapters = new Map(adapters.map((a) => [a.id, a]));
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
  ): FallbackChainEntry[] {
    const ordered = this.getOrderedChain(chain);
    if (!pinnedModel || pinnedModel === 'auto') return ordered;

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
    const chainToTry = this.getChainToTry(
      ctx.fallbackChain,
      fullRequest.model,
      fullRequest.providerId,
    );

    if (chainToTry.length === 0) {
      throw new RouterError('No models configured in fallback chain', false);
    }

    let attempts = 0;
    const now = Date.now();
    const errors: string[] = [];
    let lastFailedProvider: ProviderId | undefined;
    const pinBypassHealth = Boolean(fullRequest.providerId);

    for (const entry of chainToTry) {
      const adapter = this.adapters.get(entry.providerId);
      if (!adapter) {
        errors.push(`Unknown provider: ${entry.providerId}`);
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
          !pinBypassHealth &&
          !ctx.isKeyAvailable(entry.providerId, model, keyRecord.id)
        ) {
          errors.push(
            `${entry.providerId}/${model}: skipped (health check flagged this key — re-test in Keys)`,
          );
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
              return {
                stream: gen,
                provider: entry.providerId,
                model,
                attempts,
                failoverFrom: lastFailedProvider,
              };
            }

            const response = await adapter.chatCompletion(
              apiKey,
              model,
              providerRequest,
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
