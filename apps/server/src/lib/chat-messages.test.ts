import { describe, expect, it } from 'vitest';
import { mergeChatMessages } from './chat-messages.js';

describe('mergeChatMessages', () => {
  it('prefers the client thread when non-empty', () => {
    const stored = [
      { role: 'user' as const, content: 'old bengali context' },
      { role: 'assistant' as const, content: 'পুরনো উত্তর' },
    ];
    const incoming = [{ role: 'user' as const, content: 'hi there?' }];

    expect(mergeChatMessages(stored, incoming)).toEqual(incoming);
  });

  it('falls back to stored history when client sends nothing', () => {
    const stored = [{ role: 'user' as const, content: 'hello' }];
    expect(mergeChatMessages(stored, [])).toEqual(stored);
  });
});
