import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Router, RouterError } from './router.js';
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
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
