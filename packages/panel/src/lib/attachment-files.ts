export interface AttachmentCapabilities {
  images: boolean;
  documents: boolean;
}

const TEXT_EXTENSIONS = new Set([
  '.csv',
  '.txt',
  '.md',
  '.json',
  '.xml',
  '.html',
  '.htm',
  '.tsv',
  '.log',
  '.yaml',
  '.yml',
]);

const DOCUMENT_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx']);

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

export function isImageFile(file: { type?: string; name?: string }): boolean {
  if (file.type?.startsWith('image/')) return true;
  const ext = fileExtension(file.name ?? '');
  return ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'].includes(ext);
}

export function isTextDocumentFile(file: { type?: string; name?: string }): boolean {
  const ext = fileExtension(file.name ?? '');
  if (TEXT_EXTENSIONS.has(ext)) return true;
  const t = file.type ?? '';
  return (
    t.startsWith('text/') ||
    t === 'application/json' ||
    t === 'application/csv' ||
    t === 'text/csv'
  );
}

export function isPdfFile(file: { type?: string; name?: string }): boolean {
  return file.type === 'application/pdf' || fileExtension(file.name ?? '') === '.pdf';
}

export function isOfficeFile(file: { name?: string }): boolean {
  const ext = fileExtension(file.name ?? '');
  return ['.doc', '.docx', '.xls', '.xlsx'].includes(ext);
}

export function fileAllowedForCapabilities(
  file: { type?: string; name?: string },
  caps: AttachmentCapabilities,
): boolean {
  if (isImageFile(file)) return caps.images;
  if (isTextDocumentFile(file) || isPdfFile(file)) return caps.documents;
  if (isOfficeFile(file)) return caps.documents;
  return false;
}

export function acceptAttributeForCapabilities(caps: AttachmentCapabilities): string {
  const parts: string[] = [];
  if (caps.images) {
    parts.push('image/png', 'image/jpeg', 'image/webp', 'image/gif');
  }
  if (caps.documents) {
    parts.push(
      '.csv',
      '.txt',
      '.md',
      '.json',
      '.pdf',
      'text/csv',
      'text/plain',
      'application/pdf',
    );
  }
  return parts.join(',');
}

const MAX_TEXT_FILE_CHARS = 120_000;

/** Decode text from a data: URL (AI SDK attachment URLs are usually data URLs). */
export function readTextFromDataUrl(url: string): string {
  if (!url.startsWith('data:')) return '';
  const comma = url.indexOf(',');
  if (comma < 0) return '';
  const header = url.slice(0, comma);
  const payload = url.slice(comma + 1);
  let text = '';
  if (header.includes(';base64')) {
    try {
      text = atob(payload);
    } catch {
      return '';
    }
  } else {
    text = decodeURIComponent(payload);
  }
  if (text.length <= MAX_TEXT_FILE_CHARS) return text;
  return `${text.slice(0, MAX_TEXT_FILE_CHARS)}\n\n…[file truncated at ${MAX_TEXT_FILE_CHARS} characters]`;
}

export async function readTextFromUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return readTextFromDataUrl(url);
  const res = await fetch(url);
  const text = await res.text();
  if (text.length <= MAX_TEXT_FILE_CHARS) return text;
  return `${text.slice(0, MAX_TEXT_FILE_CHARS)}\n\n…[file truncated at ${MAX_TEXT_FILE_CHARS} characters]`;
}

export function attachmentKindLabel(file: { type?: string; name?: string }): string {
  if (isImageFile(file)) return 'image';
  if (isPdfFile(file)) return 'PDF';
  if (isTextDocumentFile(file)) return 'file';
  return 'file';
}
