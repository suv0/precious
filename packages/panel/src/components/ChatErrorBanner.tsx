import { formatChatError } from '../lib/format-chat-error';

export function ChatErrorBanner({ message }: { message: string }) {
  const { title, lines, hint } = formatChatError(message);

  return (
    <div
      className="rounded-lg border border-red-800/50 bg-red-950/40 px-4 py-3 text-sm text-red-100 space-y-2"
      role="alert"
    >
      <p className="font-display text-base text-red-200">{title}</p>
      <ul className="list-disc pl-5 space-y-1 text-red-100/95 normal-case leading-relaxed">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {hint && (
        <p className="text-xs text-red-200/80 border-t border-red-900/40 pt-2 leading-relaxed normal-case">
          {hint}
        </p>
      )}
    </div>
  );
}
