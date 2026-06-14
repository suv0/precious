import type { Message } from 'ai/react';
import { AUTO_MODEL } from './api';
import {
  isImageFile,
  isPdfFile,
  isTextDocumentFile,
  readTextFromDataUrl,
  type AttachmentCapabilities,
} from './attachment-files';
import { modelSelectValue, type ChatModelOption } from './chat-models';

type Attachment = { url: string; name?: string; contentType?: string };

function buildMessageContent(
  text: string,
  attachments: Attachment[] | undefined,
  caps: AttachmentCapabilities,
  providerId?: string,
): string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> {
  const parts: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> =
    [];

  if (text.trim()) parts.push({ type: 'text', text });

  for (const file of attachments ?? []) {
    if (isImageFile(file) && caps.images) {
      parts.push({ type: 'image_url', image_url: { url: file.url } });
      continue;
    }

    if (isTextDocumentFile(file) && caps.documents) {
      const body = readTextFromDataUrl(file.url);
      if (body) {
        parts.push({
          type: 'text',
          text: `\n\n--- Attached file: ${file.name ?? 'upload'} ---\n${body}\n--- End file ---`,
        });
      }
      continue;
    }

    if (isPdfFile(file) && caps.documents) {
      if (providerId === 'google-gemini') {
        parts.push({ type: 'image_url', image_url: { url: file.url } });
      } else {
        parts.push({
          type: 'text',
          text: `\n\n[PDF attached: ${file.name ?? 'document.pdf'} — switch to Gemini for best PDF parsing, or paste/export as text.]`,
        });
      }
    }
  }

  if (parts.length === 0) return text;
  if (parts.length === 1 && parts[0]?.type === 'text') return parts[0].text;
  return parts;
}

/** Map UI model pin (provider:model) to API model + optional provider pin. */
export function resolveModelPin(selected: string): { model: string; providerId?: string } {
  if (selected === AUTO_MODEL) return { model: AUTO_MODEL };
  const sep = selected.indexOf(':');
  if (sep > 0) {
    return {
      providerId: selected.slice(0, sep),
      model: selected.slice(sep + 1),
    };
  }
  return { model: selected };
}

function capabilitiesForSelection(
  selectedModel: string,
  models: ChatModelOption[],
): AttachmentCapabilities {
  if (selectedModel === AUTO_MODEL) {
    const anyImages = models.some((m) => m.supports_images);
    const anyDocs = models.some((m) => m.supports_documents);
    return { images: anyImages, documents: anyDocs };
  }
  const option = models.find((m) => modelSelectValue(m) === selectedModel);
  return {
    images: option?.supports_images ?? false,
    documents: option?.supports_documents ?? false,
  };
}

const TEXT_ONLY_SYSTEM_PROMPT = `You are a text-only model in Precious. You cannot receive images, screenshots, or file uploads in this session — the chat UI disables 📎 for this model because the provider API does not accept them.

If the user asks whether you can analyze images or attached files, answer honestly: not with this model. Tell them to pick a model marked 📎 in the dropdown (e.g. Gemini) for images or CSV/PDF uploads. You can still help with any text they type or paste into the message box.`;

function withTextOnlySystemHint(
  messages: Array<{ role: string; content: unknown }>,
  caps: AttachmentCapabilities,
  selectedModel: string,
): Array<{ role: string; content: unknown }> {
  const textOnly =
    selectedModel !== AUTO_MODEL && !caps.images && !caps.documents;
  if (!textOnly) return messages;

  const hasSystem = messages.some((m) => m.role === 'system');
  if (hasSystem) return messages;

  return [{ role: 'system', content: TEXT_ONLY_SYSTEM_PROMPT }, ...messages];
}

/** Must stay synchronous — useChat does not await experimental_prepareRequestBody. */
export function prepareChatRequestBody({
  messages,
  selectedModel,
  models,
}: {
  messages: Message[];
  selectedModel: string;
  models: ChatModelOption[];
}): Record<string, unknown> {
  const { model, providerId } = resolveModelPin(selectedModel);
  const caps = capabilitiesForSelection(selectedModel, models);

  const apiMessages = withTextOnlySystemHint(
    messages.map((m, index) => {
      const isLast = index === messages.length - 1;
      if (isLast && m.role === 'user' && m.experimental_attachments?.length) {
        return {
          role: m.role,
          content: buildMessageContent(
            m.content,
            m.experimental_attachments,
            caps,
            providerId,
          ),
        };
      }
      return { role: m.role, content: m.content };
    }),
    caps,
    selectedModel,
  );

  const body: Record<string, unknown> = {
    messages: apiMessages,
    model,
    stream: true,
  };

  if (providerId) {
    body.providerId = providerId;
  }

  // Set attachment flags for vision auto-routing
  if (messages.some((m) => m.experimental_attachments?.length)) {
    body.hasAttachments = true;
    const types: string[] = [];
    if (caps.images) types.push('image');
    if (caps.documents) types.push('document');
    body.attachmentTypes = types;
  }

  return body;
}

export { attachmentKindLabel } from './attachment-files';
