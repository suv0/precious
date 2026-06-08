import type { ReactNode } from 'react';

/** Minimal inline markdown: **bold**, *italic*, `code`. No new dependencies. */
function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      parts.push(
        <code
          key={key++}
          className="rounded bg-emerald-950/60 px-1 py-0.5 text-[0.85em] font-mono text-precious-gold/90"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      parts.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }
    last = match.index + token.length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : [text];
}

export function MarkdownLite({ text }: { text: string }) {
  const blocks = text.split(/\n\n+/);

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={i} className="font-display text-precious-gold/90 text-sm mt-1">
              {renderInline(trimmed.slice(4))}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={i} className="font-display text-precious-gold text-base mt-1">
              {renderInline(trimmed.slice(3))}
            </h3>
          );
        }

        const lines = trimmed.split('\n');
        if (lines.every((l) => /^[-*]\s+/.test(l.trim()))) {
          return (
            <ul key={i} className="list-disc pl-5 space-y-1 text-precious-text/95">
              {lines.map((line, j) => (
                <li key={j}>{renderInline(line.trim().replace(/^[-*]\s+/, ''))}</li>
              ))}
            </ul>
          );
        }

        if (lines.every((l) => /^\d+\.\s+/.test(l.trim()))) {
          return (
            <ol key={i} className="list-decimal pl-5 space-y-1 text-precious-text/95">
              {lines.map((line, j) => (
                <li key={j}>{renderInline(line.trim().replace(/^\d+\.\s+/, ''))}</li>
              ))}
            </ol>
          );
        }

        if (trimmed.startsWith('> ')) {
          return (
            <blockquote
              key={i}
              className="border-l-2 border-precious-gold/40 pl-3 text-precious-muted italic"
            >
              {renderInline(trimmed.replace(/^>\s?/gm, ''))}
            </blockquote>
          );
        }

        return (
          <p key={i} className="whitespace-pre-wrap break-words leading-relaxed">
            {lines.map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {renderInline(line)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
