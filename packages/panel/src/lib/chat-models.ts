import { AUTO_MODEL } from './api';
import { labelProvider } from './parse-chat-content';

export interface ChatModelOption {
  id: string;
  owned_by: string;
  supports_attachments?: boolean;
  supports_images?: boolean;
  supports_documents?: boolean;
}

/** Dropdown value: model id, or providerId:model (split on first colon only). */
export function modelSelectValue(m: ChatModelOption): string {
  if (m.id === AUTO_MODEL) return AUTO_MODEL;
  if (m.owned_by && m.owned_by !== 'precious') return `${m.owned_by}:${m.id}`;
  return m.id;
}

export function formatModelOptionLabel(m: ChatModelOption): string {
  if (m.id === AUTO_MODEL) return 'Auto (best available)';
  const provider = labelProvider(m.owned_by);
  const attach = m.supports_attachments ? ' 📎' : '';
  const modes: string[] = [];
  if (m.supports_images) modes.push('images');
  if (m.supports_documents) modes.push('files');
  const modeHint = attach && modes.length === 1 ? ` (${modes[0]})` : '';
  return `${provider} · ${m.id}${attach}${modeHint}`;
}

export function dedupeModelOptions(models: ChatModelOption[]): ChatModelOption[] {
  const seen = new Set<string>();
  return models.filter((m) => {
    const key = modelSelectValue(m);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function attachmentCapabilitiesForModel(
  selectedModel: string,
  models: ChatModelOption[],
): { images: boolean; documents: boolean; any: boolean } {
  if (selectedModel === AUTO_MODEL) {
    const images = models.some((m) => m.id !== AUTO_MODEL && m.supports_images);
    const documents = models.some((m) => m.id !== AUTO_MODEL && m.supports_documents);
    return { images, documents, any: images || documents };
  }
  const option = models.find((m) => modelSelectValue(m) === selectedModel);
  const images = option?.supports_images ?? false;
  const documents = option?.supports_documents ?? false;
  return { images, documents, any: images || documents };
}

/** Uses supports_attachments from API (images and/or documents). */
export function modelSupportsAttachments(
  selectedModel: string,
  models: ChatModelOption[],
): boolean {
  if (selectedModel === AUTO_MODEL) {
    const auto = models.find((m) => m.id === AUTO_MODEL);
    if (auto?.supports_attachments) return true;
    return models.some((m) => m.id !== AUTO_MODEL && m.supports_attachments);
  }
  const option = models.find((m) => modelSelectValue(m) === selectedModel);
  return option?.supports_attachments ?? false;
}

export function firstVisionModelValue(models: ChatModelOption[]): string | null {
  const match = models.find((m) => m.id !== AUTO_MODEL && m.supports_attachments);
  return match ? modelSelectValue(match) : null;
}

export function visionModelLabels(models: ChatModelOption[], limit = 2): string {
  const names = models
    .filter((m) => m.id !== AUTO_MODEL && m.supports_attachments)
    .slice(0, limit)
    .map((m) => `${labelProvider(m.owned_by)} · ${m.id}`);
  return names.join(', ') || 'a model marked 📎 in the dropdown';
}
