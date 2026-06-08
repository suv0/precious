import type { Message } from 'ai/react';
import { AUTO_MODEL } from './api';
import { modelSelectValue, type ChatModelOption } from './chat-models';

type Attachment = { url: string; name?: string; contentType?: string };

function buildMultimodalContent(text: string, attachments?: Attachment[]) {
  const parts: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [];
  if (text.trim()) parts.push({ type: 'text', text });
  for (const file of attachments ?? []) {
    if (file.contentType?.startsWith('image/')) {
      parts.push({ type: 'image_url', image_url: { url: file.url } });
    }
  }
  return parts.length === 1 && parts[0]?.type === 'text' ? parts[0].text : parts;
}

/** Map UI model pin (provider:model) to API model + optional provider pin. */
export function resolveModelPin(selected: string): { model: string; providerId?: string } {
  if (selected === AUTO_MODEL) return { model: AUTO_MODEL };
  const sep = selected.indexOf(':');
  if (sep > 0) {
    return {
      providerId: selected.slice(0, sep),
      // Model ids may contain colons (e.g. OpenRouter meta-llama/...:free).
      model: selected.slice(sep + 1),
    };
  }
  return { model: selected };
}

export function prepareChatRequestBody({
  messages,
  selectedModel,
  models,
}: {
  messages: Message[];
  selectedModel: string;
  models: ChatModelOption[];
}) {
  const { model, providerId } = resolveModelPin(selectedModel);

  const apiMessages = messages.map((m, index) => {
    const isLast = index === messages.length - 1;
    if (isLast && m.role === 'user' && m.experimental_attachments?.length) {
      return {
        role: m.role,
        content: buildMultimodalContent(m.content, m.experimental_attachments),
      };
    }
    return { role: m.role, content: m.content };
  });

  const body: Record<string, unknown> = {
    messages: apiMessages,
    model,
    stream: true,
  };

  if (providerId) {
    body.providerId = providerId;
  }

  return body;
}
