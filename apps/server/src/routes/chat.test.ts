import { describe, it, expect } from 'vitest';
import { sseToPlainText } from './chat.js';

describe('sseToPlainText', () => {
  it('yields plain text from SSE chunks', async () => {
    async function* stream() {
      yield 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n';
      yield 'data: {"choices":[{"delta":{"content":" world"}}]}\n\n';
      yield 'data: [DONE]\n\n';
    }

    const usageOut = { current: null };
    const result: string[] = [];
    for await (const text of sseToPlainText(stream(), usageOut)) {
      result.push(text);
    }
    expect(result).toEqual(['Hello', ' world']);
  });

  it('throws on mid-stream error chunk', async () => {
    async function* stream() {
      yield 'data: {"choices":[{"delta":{"content":"partial text"}}]}\n\n';
      yield 'data: {"error":{"message":"rate limit exceeded"}}\n\n';
    }

    const result: string[] = [];
    const usageOut = { current: null };

    await expect(
      (async () => {
        for await (const text of sseToPlainText(stream(), usageOut)) {
          result.push(text);
        }
      })(),
    ).rejects.toThrow('rate limit exceeded');

    // Partial text before the error should have been yielded
    expect(result).toEqual(['partial text']);
  });

  it('skips malformed JSON chunks', async () => {
    async function* stream() {
      yield 'data: not json\n\n';
      yield 'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n';
      yield 'data: [DONE]\n\n';
    }

    const usageOut = { current: null };
    const result: string[] = [];
    for await (const text of sseToPlainText(stream(), usageOut)) {
      result.push(text);
    }
    expect(result).toEqual(['ok']);
  });

  it('returns silently on empty stream followed by [DONE]', async () => {
    async function* stream() {
      yield 'data: [DONE]\n\n';
    }

    const usageOut = { current: null };
    const result: string[] = [];
    for await (const text of sseToPlainText(stream(), usageOut)) {
      result.push(text);
    }
    expect(result).toEqual([]);
  });
});
