import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Router, RouterError } from './router.js';
import { PerKeyRateLedger } from './per-key-rate.js';
import { DEFAULT_KEY_RATE_LIMITS } from './key-health.js';
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  ProviderId,
  RouterContext,
} from './types.js';

const FULL_MESSAGES = [
  { role: 'system' as const, content: 'You are helpful.' },
  { role: 'user' as const, content: 'Remember the number 42.' },
  { role: 'assistant' as const, content: 'Got it — 42.' },
  { role: 'user' as const, content: 'What number did I mention?' },
];

function makeContext(): RouterContext {
  return {
    userId: 'test-user',
    fallbackChain: [
      { providerId: 'groq', model: 'llama-groq', priority: 0, enabled: true },
      { providerId: 'mistral', model: 'mistral-small', priority: 1, enabled: true },
    ],
    providerKeys: [
      {
        id: 'key-groq',
        providerId: 'groq',
        label: 'groq',
        encryptedKey: 'enc-groq',
      },
      {
        id: 'key-mistral',
        providerId: 'mistral',
        label: 'mistral',
        encryptedKey: 'enc-mistral',
      },
    ],
    decryptKey: (enc) => enc,
    maxAttempts: 5,
  };
}

function okResponse(provider: ProviderId, model: string): ChatCompletionResponse {
  return {
    id: 'test',
    object: 'chat.completion',
    created: Date.now(),
    model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: `from ${provider}` },
        finish_reason: 'stop',
      },
    ],
  };
}

describe('Router failover', () => {
  it('retries next provider with the full messages array on 429', async () => {
    const received: Array<{ provider: ProviderId; messages: ChatCompletionRequest['messages'] }> =
      [];

    const groqAdapter = {
      id: 'groq' as ProviderId,
      chatCompletion: mock.fn(async (_key, _model, request) => {
        received.push({ provider: 'groq', messages: request.messages });
        throw new RouterError('429 rate limit', true);
      }),
      streamChatCompletion: async function* () {
        yield '';
      },
    };

    const mistralAdapter = {
      id: 'mistral' as ProviderId,
      chatCompletion: mock.fn(async (_key, _model, request) => {
        received.push({ provider: 'mistral', messages: request.messages });
        return okResponse('mistral', 'mistral-small');
      }),
      streamChatCompletion: async function* () {
        yield '';
      },
    };

    const router = new Router([groqAdapter, mistralAdapter]);
    const request: ChatCompletionRequest = {
      model: 'auto',
      messages: FULL_MESSAGES,
      stream: false,
    };

    const result = await router.route(makeContext(), request, false);

    assert.equal(result.provider, 'mistral');
    assert.equal(result.failoverFrom, 'groq');
    assert.equal(received.length, 2);
    assert.deepEqual(received[0].messages, FULL_MESSAGES);
    assert.deepEqual(received[1].messages, FULL_MESSAGES);
    assert.equal(result.response?.choices[0].message.content, 'from mistral');
  });

  it('uses chain entry model on failover, not the pinned model name', async () => {
    const modelsUsed: string[] = [];

    const groqAdapter = {
      id: 'groq' as ProviderId,
      chatCompletion: mock.fn(async (_key, model) => {
        modelsUsed.push(model);
        throw new RouterError('429 rate limit', true);
      }),
      streamChatCompletion: async function* () {
        yield '';
      },
    };

    const mistralAdapter = {
      id: 'mistral' as ProviderId,
      chatCompletion: mock.fn(async (_key, model) => {
        modelsUsed.push(model);
        return okResponse('mistral', model);
      }),
      streamChatCompletion: async function* () {
        yield '';
      },
    };

    const router = new Router([groqAdapter, mistralAdapter]);
    await router.route(
      makeContext(),
      { model: 'auto', messages: FULL_MESSAGES },
      false,
    );

    assert.deepEqual(modelsUsed, ['llama-groq', 'mistral-small']);
  });

  it('pinned provider+model does not failover to other providers', async () => {
    const providersTried: ProviderId[] = [];

    const groqAdapter = {
      id: 'groq' as ProviderId,
      chatCompletion: mock.fn(async () => {
        providersTried.push('groq');
        throw new RouterError('429 rate limit', true);
      }),
      streamChatCompletion: async function* () {
        yield '';
      },
    };

    const mistralAdapter = {
      id: 'mistral' as ProviderId,
      chatCompletion: mock.fn(async () => {
        providersTried.push('mistral');
        return okResponse('mistral', 'mistral-small');
      }),
      streamChatCompletion: async function* () {
        yield '';
      },
    };

    const router = new Router([groqAdapter, mistralAdapter]);

    await assert.rejects(
      () =>
        router.route(
          makeContext(),
          {
            model: 'llama-groq',
            providerId: 'groq',
            messages: FULL_MESSAGES,
          },
          false,
        ),
      RouterError,
    );

    assert.deepEqual(providersTried, ['groq']);
  });

  it('passes tool definitions and tool_choice through to the adapter', async () => {
    const received: ChatCompletionRequest[] = [];

    const groqAdapter = {
      id: 'groq' as ProviderId,
      chatCompletion: mock.fn(async (_key, _model, request) => {
        received.push(request);
        return okResponse('groq', 'llama-groq');
      }),
      streamChatCompletion: async function* () {
        yield '';
      },
    };

    const router = new Router([groqAdapter]);
    const request: ChatCompletionRequest = {
      model: 'auto',
      messages: FULL_MESSAGES,
      stream: false,
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get current weather',
            parameters: { location: 'string' },
          },
        },
      ],
      tool_choice: 'auto',
    };

    await router.route(makeContext(), request, false);

    assert.equal(received.length, 1);
    assert.equal(received[0]?.tools?.length, 1);
    assert.equal(received[0]?.tools?.[0]?.function?.name, 'get_weather');
    assert.equal(received[0]?.tool_choice, 'auto');
  });

  it('model auto walks full fallback chain from the start', async () => {
    const order: ProviderId[] = [];

    const groqAdapter = {
      id: 'groq' as ProviderId,
      chatCompletion: mock.fn(async () => {
        order.push('groq');
        return okResponse('groq', 'llama-groq');
      }),
      streamChatCompletion: async function* () {
        yield '';
      },
    };

    const mistralAdapter = {
      id: 'mistral' as ProviderId,
      chatCompletion: mock.fn(async () => {
        order.push('mistral');
        return okResponse('mistral', 'mistral-small');
      }),
      streamChatCompletion: async function* () {
        yield '';
      },
    };

    const router = new Router([groqAdapter, mistralAdapter]);
    const result = await router.route(
      makeContext(),
      { model: 'auto', messages: FULL_MESSAGES },
      false,
    );

    assert.equal(result.provider, 'groq');
    assert.deepEqual(order, ['groq']);
  });
});

function okEmbeddingResponse(provider: ProviderId, model: string): EmbeddingResponse {
  return {
    object: 'list',
    data: [{ object: 'embedding', index: 0, embedding: [0.1, 0.2, 0.3] }],
    model,
    usage: { prompt_tokens: 3, total_tokens: 3 },
  };
}

describe('Router embeddings', () => {
  it('retries next provider with embedding on 429', async () => {
    const providersCalled: ProviderId[] = [];

    const groqAdapter = {
      id: 'groq' as ProviderId,
      chatCompletion: mock.fn(async () => okResponse('groq', 'llama-groq')),
      streamChatCompletion: async function* () { yield ''; },
      embedding: mock.fn(async () => {
        providersCalled.push('groq');
        throw new RouterError('429 rate limit', true);
      }),
    };

    const mistralAdapter = {
      id: 'mistral' as ProviderId,
      chatCompletion: mock.fn(async () => okResponse('mistral', 'mistral-small')),
      streamChatCompletion: async function* () { yield ''; },
      embedding: mock.fn(async () => {
        providersCalled.push('mistral');
        return okEmbeddingResponse('mistral', 'mistral-embed');
      }),
    };

    const router = new Router([groqAdapter, mistralAdapter]);
    const request: EmbeddingRequest = {
      model: 'auto',
      input: 'hello world',
    };

    const result = await router.routeEmbedding(makeContext(), request);

    assert.equal(result.provider, 'mistral');
    assert.equal(result.failoverFrom, 'groq');
    assert.deepEqual(providersCalled, ['groq', 'mistral']);
    assert.equal(result.response.data[0].embedding.length, 3);
  });

  it('skips adapters without embedding method', async () => {
    const textOnlyAdapter = {
      id: 'kilo' as ProviderId,
      chatCompletion: mock.fn(async () => okResponse('kilo', 'kilo-free')),
      streamChatCompletion: async function* () { yield ''; },
      // no embedding method
    };

    let openaiCalled = false;
    const openaiAdapter = {
      id: 'openai' as ProviderId,
      chatCompletion: mock.fn(async () => okResponse('openai', 'gpt-4o')),
      streamChatCompletion: async function* () { yield ''; },
      embedding: mock.fn(async () => {
        openaiCalled = true;
        return okEmbeddingResponse('openai', 'text-embedding-3-small');
      }),
    };

    const ctx = makeContext();
    ctx.fallbackChain = [
      { providerId: 'kilo', model: 'kilo-free', priority: 0, enabled: true },
      { providerId: 'openai', model: 'text-embedding-3-small', priority: 1, enabled: true },
    ];
    ctx.providerKeys = [
      { id: 'key-kilo', providerId: 'kilo', label: 'kilo', encryptedKey: 'enc-kilo' },
      { id: 'key-openai', providerId: 'openai', label: 'openai', encryptedKey: 'enc-openai' },
    ];

    const router = new Router([textOnlyAdapter, openaiAdapter]);
    const result = await router.routeEmbedding(ctx, {
      model: 'auto',
      input: 'test',
    });

    assert.equal(result.provider, 'openai');
    assert.ok(openaiCalled);
  });

  it('pinned provider+model does not failover for embeddings', async () => {
    const groqAdapter = {
      id: 'groq' as ProviderId,
      chatCompletion: mock.fn(async () => okResponse('groq', 'llama-groq')),
      streamChatCompletion: async function* () { yield ''; },
      embedding: mock.fn(async () => {
        throw new RouterError('429 rate limit', true);
      }),
    };

    const router = new Router([groqAdapter]);

    await assert.rejects(
      () =>
        router.routeEmbedding(makeContext(), {
          model: 'llama-groq',
          providerId: 'groq',
          input: 'test',
        }),
      RouterError,
    );
  });
});

describe('Vision auto-routing', () => {
  function capsCheck(providerId: ProviderId, _model: string) {
    if (providerId === 'google-gemini' || providerId === 'openai') {
      return { images: true, documents: true };
    }
    return { images: false, documents: false };
  }

  it('filters text-only models when request has images', async () => {
    const groqAdapter = {
      id: 'groq' as ProviderId,
      chatCompletion: mock.fn(async () => okResponse('groq', 'llama-groq')),
      streamChatCompletion: async function* () { yield ''; },
    };

    let geminiCalled = false;
    const geminiAdapter = {
      id: 'google-gemini' as ProviderId,
      chatCompletion: mock.fn(async () => {
        geminiCalled = true;
        return okResponse('google-gemini', 'gemini-2.5-flash');
      }),
      streamChatCompletion: async function* () { yield ''; },
    };

    const ctx = makeContext();
    ctx.fallbackChain = [
      { providerId: 'groq', model: 'llama-groq', priority: 0, enabled: true },
      { providerId: 'google-gemini', model: 'gemini-2.5-flash', priority: 1, enabled: true },
    ];
    ctx.providerKeys = [
      { id: 'key-groq', providerId: 'groq', label: 'groq', encryptedKey: 'enc-groq' },
      { id: 'key-gemini', providerId: 'google-gemini', label: 'gemini', encryptedKey: 'enc-gemini' },
    ];

    const router = new Router([groqAdapter, geminiAdapter], capsCheck);
    const request: ChatCompletionRequest = {
      model: 'auto',
      messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:image/png,test' } }] }],
      hasAttachments: true,
      attachmentTypes: ['image'],
    };

    const result = await router.route(ctx, request, false);

    assert.equal(result.provider, 'google-gemini');
    assert.ok(geminiCalled);
  });

  it('throws when no model supports required attachments', async () => {
    const groqAdapter = {
      id: 'groq' as ProviderId,
      chatCompletion: mock.fn(async () => okResponse('groq', 'llama-groq')),
      streamChatCompletion: async function* () { yield ''; },
    };

    const router = new Router([groqAdapter], capsCheck);
    const request: ChatCompletionRequest = {
      model: 'auto',
      messages: [{ role: 'user', content: 'Describe this image' }],
      hasAttachments: true,
      attachmentTypes: ['image'],
    };

    await assert.rejects(
      () => router.route(makeContext(), request, false),
      /No provider.*supports.*attachments/,
    );
  });

  it('does not filter when hasAttachments is false', async () => {
    let groqCalled = false;
    const groqAdapter = {
      id: 'groq' as ProviderId,
      chatCompletion: mock.fn(async () => {
        groqCalled = true;
        return okResponse('groq', 'llama-groq');
      }),
      streamChatCompletion: async function* () { yield ''; },
    };

    const router = new Router([groqAdapter], capsCheck);
    const request: ChatCompletionRequest = {
      model: 'auto',
      messages: FULL_MESSAGES,
    };

    const result = await router.route(makeContext(), request, false);
    assert.equal(result.provider, 'groq');
    assert.ok(groqCalled);
  });
});

describe('Sticky sessions', () => {
  it('reuses the same provider on second request', async () => {
    let groqCalls = 0;
    const groqAdapter = {
      id: 'groq' as ProviderId,
      chatCompletion: mock.fn(async () => {
        groqCalls += 1;
        return okResponse('groq', 'llama-groq');
      }),
      streamChatCompletion: async function* () { yield ''; },
    };

    let mistralCalls = 0;
    const mistralAdapter = {
      id: 'mistral' as ProviderId,
      chatCompletion: mock.fn(async () => {
        mistralCalls += 1;
        return okResponse('mistral', 'mistral-small');
      }),
      streamChatCompletion: async function* () { yield ''; },
    };

    const router = new Router([groqAdapter, mistralAdapter]);
    const request: ChatCompletionRequest = {
      model: 'auto',
      messages: FULL_MESSAGES,
    };

    // First call: groq succeeds
    const result1 = await router.route(makeContext(), request, false);
    assert.equal(result1.provider, 'groq');
    assert.equal(groqCalls, 1);

    // Second call: should reuse groq from sticky session
    const result2 = await router.route(makeContext(), request, false);
    assert.equal(result2.provider, 'groq');
    assert.equal(groqCalls, 2);
    assert.equal(mistralCalls, 0);
  });

  it('falls through to chain after sticky session fails', async () => {
    let firstGroqCall = true;
    const groqAdapter = {
      id: 'groq' as ProviderId,
      chatCompletion: mock.fn(async () => {
        if (firstGroqCall) {
          firstGroqCall = false;
          return okResponse('groq', 'llama-groq');
        }
        throw new RouterError('429 rate limit', true);
      }),
      streamChatCompletion: async function* () { yield ''; },
    };

    let mistralCalls = 0;
    const mistralAdapter = {
      id: 'mistral' as ProviderId,
      chatCompletion: mock.fn(async () => {
        mistralCalls += 1;
        return okResponse('mistral', 'mistral-small');
      }),
      streamChatCompletion: async function* () { yield ''; },
    };

    const router = new Router([groqAdapter, mistralAdapter]);
    const request: ChatCompletionRequest = {
      model: 'auto',
      messages: FULL_MESSAGES,
    };

    // First call: groq succeeds, sets sticky
    const result1 = await router.route(makeContext(), request, false);
    assert.equal(result1.provider, 'groq');

    // Second call: sticky tries groq, fails, falls through to mistral
    const result2 = await router.route(makeContext(), request, false);
    assert.equal(result2.provider, 'mistral');
    assert.equal(mistralCalls, 1);
  });
});

describe('Pinned provider cooldown bypass', () => {
  it('bypasses cooldown when provider is explicitly pinned', async () => {
    let groqCalled = false;
    const groqAdapter = {
      id: 'groq' as ProviderId,
      chatCompletion: mock.fn(async () => {
        groqCalled = true;
        return okResponse('groq', 'llama-groq');
      }),
      streamChatCompletion: async function* () { yield ''; },
    };

    const router = new Router([groqAdapter]);

    // Pre-set cooldown on groq key
    const cdKey = 'groq:llama-groq:key-groq';
    (router as unknown as { cooldowns: Map<string, { until: number }> }).cooldowns.set(cdKey, {
      until: Date.now() + 30_000,
    });

    const ctx = makeContext();
    ctx.fallbackChain = [{ providerId: 'groq', model: 'llama-groq', priority: 0, enabled: true }];
    const request: ChatCompletionRequest = {
      model: 'llama-groq',
      providerId: 'groq',
      messages: FULL_MESSAGES,
    };

    const result = await router.route(ctx, request, false);
    assert.equal(result.provider, 'groq');
    assert.ok(groqCalled);
  });

  it('still respects cooldown when no provider is pinned', async () => {
    let mistralCalled = false;
    const groqAdapter = {
      id: 'groq' as ProviderId,
      chatCompletion: mock.fn(async () => okResponse('groq', 'llama-groq')),
      streamChatCompletion: async function* () { yield ''; },
    };
    const mistralAdapter = {
      id: 'mistral' as ProviderId,
      chatCompletion: mock.fn(async () => {
        mistralCalled = true;
        return okResponse('mistral', 'mistral-small');
      }),
      streamChatCompletion: async function* () { yield ''; },
    };

    const router = new Router([groqAdapter, mistralAdapter]);

    // Cooldown the ONLY key for groq
    const cdKey = 'groq:llama-groq:key-groq';
    (router as unknown as { cooldowns: Map<string, { until: number }> }).cooldowns.set(cdKey, {
      until: Date.now() + 30_000,
    });

    const ctx = makeContext();
    const request: ChatCompletionRequest = {
      model: 'auto',
      messages: FULL_MESSAGES,
    };

    const result = await router.route(ctx, request, false);
    assert.equal(result.provider, 'mistral');
    assert.ok(mistralCalled);
  });
});

describe('All-cooldown last-resort retry', () => {
  it('force-tries the least-cooldowned key when all keys are on cooldown', async () => {
    let groqCalls = 0;
    const groqAdapter = {
      id: 'groq' as ProviderId,
      chatCompletion: mock.fn(async () => {
        groqCalls += 1;
        return okResponse('groq', 'llama-groq');
      }),
      streamChatCompletion: async function* () { yield ''; },
    };

    let mistralCalls = 0;
    const mistralAdapter = {
      id: 'mistral' as ProviderId,
      chatCompletion: mock.fn(async () => {
        mistralCalls += 1;
        throw new RouterError('429 rate limit', true);
      }),
      streamChatCompletion: async function* () { yield ''; },
    };

    const router = new Router([groqAdapter, mistralAdapter]);

    // Cooldown both keys — groq cooldown expires sooner
    (router as unknown as { cooldowns: Map<string, { until: number }> }).cooldowns.set(
      'groq:llama-groq:key-groq',
      { until: Date.now() + 10_000 },
    );
    (router as unknown as { cooldowns: Map<string, { until: number }> }).cooldowns.set(
      'mistral:mistral-small:key-mistral',
      { until: Date.now() + 20_000 },
    );

    const ctx = makeContext();
    const request: ChatCompletionRequest = {
      model: 'auto',
      messages: FULL_MESSAGES,
    };

    // groq should be picked (earliest expiry) and succeed
    const result = await router.route(ctx, request, false);
    assert.equal(result.provider, 'groq');
    assert.equal(groqCalls, 1);
    assert.equal(mistralCalls, 0);
  });

  it('throws with all-cooldown error message when last-resort also fails', async () => {
    const groqAdapter = {
      id: 'groq' as ProviderId,
      chatCompletion: mock.fn(async () => {
        throw new RouterError('429 rate limit', true);
      }),
      streamChatCompletion: async function* () { yield ''; },
    };

    const mistralAdapter = {
      id: 'mistral' as ProviderId,
      chatCompletion: mock.fn(async () => {
        throw new RouterError('429 rate limit', true);
      }),
      streamChatCompletion: async function* () { yield ''; },
    };

    const router = new Router([groqAdapter, mistralAdapter]);

    (router as unknown as { cooldowns: Map<string, { until: number }> }).cooldowns.set(
      'groq:llama-groq:key-groq',
      { until: Date.now() + 10_000 },
    );
    (router as unknown as { cooldowns: Map<string, { until: number }> }).cooldowns.set(
      'mistral:mistral-small:key-mistral',
      { until: Date.now() + 20_000 },
    );

    const ctx = makeContext();
    const request: ChatCompletionRequest = {
      model: 'auto',
      messages: FULL_MESSAGES,
    };

    await assert.rejects(
      () => router.route(ctx, request, false),
      /temporarily unavailable/,
    );
  });
});

describe('PerKeyRateLedger stale entry pruning', () => {
  it('prunes entries whose windows have fully expired', () => {
    const ledger = new PerKeyRateLedger(DEFAULT_KEY_RATE_LIMITS);
    const now = Date.now();

    // Load an entry with a day window from 25 hours ago and at max requests
    const staleDayStart = now - 25 * 60 * 60 * 1000;
    ledger.load('test:model:key1', {
      minuteCount: 0,
      minuteWindowStart: staleDayStart,
      dayCount: 15000,
      dayWindowStart: staleDayStart,
      tokensToday: 0,
    });

    assert.equal(ledger.isAvailable('test:model:key1', now), true);
  });

  it('keeps active entries that are within window', () => {
    const ledger = new PerKeyRateLedger(DEFAULT_KEY_RATE_LIMITS);
    const now = Date.now();

    ledger.load('test:model:key1', {
      minuteCount: 30, // at RPM limit
      minuteWindowStart: now - 30_000, // still within minute window
      dayCount: 14999,
      dayWindowStart: now - 12 * 60 * 60 * 1000, // within day window
      tokensToday: 0,
    });

    assert.equal(ledger.isAvailable('test:model:key1', now), false);
  });
});
