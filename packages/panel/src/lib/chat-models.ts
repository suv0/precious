import { AUTO_MODEL } from './api';
import { labelProvider } from './parse-chat-content';

export interface ChatModelOption {
  id: string;
  owned_by: string;
  supports_attachments?: boolean;
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
  return `${provider} · ${m.id}${attach}`;
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

/** Uses supports_attachments from API (derived from provider vision rules). */
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
