'use client';

import { useEffect, useRef, useState } from 'react';
import {
  acceptAttributeForCapabilities,
  attachmentKindLabel,
  fileAllowedForCapabilities,
  isImageFile,
  type AttachmentCapabilities,
} from '../lib/attachment-files';

export interface PendingAttachment {
  file: File;
  previewUrl: string;
  kind: string;
}

interface ChatComposerProps {
  input: string;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (attachments: File[]) => void;
  isLoading: boolean;
  attachmentCapabilities: AttachmentCapabilities;
  attachmentsHint?: string;
  placeholder?: string;
}

export function ChatComposer({
  input,
  onInputChange,
  onSubmit,
  isLoading,
  attachmentCapabilities,
  attachmentsHint,
  placeholder = 'Ask anything…',
}: ChatComposerProps) {
  const attachmentsEnabled =
    attachmentCapabilities.images || attachmentCapabilities.documents;

  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [rejectHint, setRejectHint] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    return () => {
      pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, [pending]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const addFiles = (files: FileList | File[] | null) => {
    if (!files?.length) return;
    setRejectHint(null);
    const next: PendingAttachment[] = [];
    let rejected = 0;
    for (const file of Array.from(files)) {
      if (!fileAllowedForCapabilities(file, attachmentCapabilities)) {
        rejected += 1;
        continue;
      }
      next.push({
        file,
        previewUrl: URL.createObjectURL(file),
        kind: attachmentKindLabel(file),
      });
    }
    if (rejected > 0) {
      setRejectHint('That file type is not supported for this model.');
    }
    if (next.length) setPending((prev) => [...prev, ...next]);
  };

  const removeAttachment = (index: number) => {
    setPending((prev) => {
      const copy = [...prev];
      const [removed] = copy.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return copy;
    });
  };

  const pasteScreenshot = async () => {
    setMenuOpen(false);
    if (!attachmentCapabilities.images) return;
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (!imageType) continue;
        const blob = await item.getType(imageType);
        const file = new File([blob], `screenshot-${Date.now()}.png`, {
          type: imageType,
        });
        addFiles([file]);
        return;
      }
    } catch {
      /* clipboard blocked — user can Ctrl+V in the box */
    }
    textareaRef.current?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!attachmentsEnabled) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          setRejectHint(
            attachmentsHint ??
              'This model cannot receive images — switch to a model with 📎 (e.g. Gemini).',
          );
          break;
        }
      }
      return;
    }
    if (!attachmentCapabilities.images) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length) {
      e.preventDefault();
      addFiles(imageFiles);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    if (!input.trim() && pending.length === 0) return;
    onSubmit(pending.map((p) => p.file));
    pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPending([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  const canSend = !isLoading && (input.trim().length > 0 || pending.length > 0);
  const acceptAttr = acceptAttributeForCapabilities(attachmentCapabilities);

  const attachHelp =
    attachmentCapabilities.images && attachmentCapabilities.documents
      ? '📎 images, CSV, PDF, text files'
      : attachmentCapabilities.images
        ? '📎 images & screenshots'
        : attachmentCapabilities.documents
          ? '📎 CSV, PDF, text files'
          : '';

  return (
    <div className="space-y-2 shrink-0">
      {pending.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {pending.map((p, i) => (
            <li
              key={p.previewUrl}
              className="relative group rounded-lg border border-emerald-900/50 overflow-hidden"
            >
              {isImageFile(p.file) ? (
                <div className="w-14 h-14">
                  <img src={p.previewUrl} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="px-3 py-2 max-w-[10rem] bg-precious-bg/80">
                  <p className="text-[10px] uppercase text-precious-muted">{p.kind}</p>
                  <p className="text-xs text-precious-text truncate">{p.file.name}</p>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeAttachment(i)}
                className="absolute inset-0 bg-black/60 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remove attachment"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {rejectHint && <p className="text-[11px] text-amber-300/90">{rejectHint}</p>}

      <form ref={formRef} onSubmit={handleFormSubmit} className="flex gap-2 items-end">
        {attachmentsEnabled && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptAttr}
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                setMenuOpen(false);
              }}
            />

            <div className="relative shrink-0" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                disabled={isLoading}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-900/60 bg-precious-bg/80 text-precious-muted hover:text-precious-gold hover:border-emerald-700/60 transition-colors text-base leading-none"
                aria-label="Attach file or image"
                aria-expanded={menuOpen}
                title="Attach file or image"
              >
                📎
              </button>
              {menuOpen && (
                <div
                  className="absolute bottom-full left-0 mb-1 min-w-[11rem] rounded-lg border border-emerald-900/60 bg-precious-surface shadow-lg py-1 z-20"
                  role="menu"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full text-left px-3 py-2 text-sm text-precious-text hover:bg-emerald-950/50"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {attachmentCapabilities.documents ? 'Upload file…' : 'Upload image…'}
                  </button>
                  {attachmentCapabilities.images && (
                    <button
                      type="button"
                      role="menuitem"
                      className="w-full text-left px-3 py-2 text-sm text-precious-text hover:bg-emerald-950/50"
                      onClick={pasteScreenshot}
                    >
                      Paste screenshot
                    </button>
                  )}
                  <p className="px-3 py-1.5 text-[10px] text-precious-muted border-t border-emerald-900/40 leading-relaxed">
                    {attachmentCapabilities.images ? 'Ctrl+V for screenshots. ' : ''}
                    {attachmentCapabilities.documents ? 'CSV, TXT, PDF supported.' : ''}
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        <textarea
          ref={textareaRef}
          rows={1}
          className="flex-1 min-w-0 resize-none rounded-lg border border-emerald-900/60 bg-precious-bg/80 px-3 py-2.5 text-sm text-precious-text placeholder:text-precious-muted focus:outline-none focus:border-emerald-700/70 max-h-32 overflow-y-auto"
          value={input}
          onChange={onInputChange}
          onKeyDown={onKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          disabled={isLoading}
          aria-label="Message"
        />

        <button
          type="submit"
          className="precious-btn-primary shrink-0 h-10 px-4"
          disabled={!canSend}
        >
          Send
        </button>
      </form>
      <p className="text-[10px] text-precious-muted/80 leading-relaxed">
        Enter to send · Shift+Enter for new line
        {attachmentsEnabled ? ` · ${attachHelp}` : attachmentsHint ? ` · ${attachmentsHint}` : ''}
      </p>
    </div>
  );
}
