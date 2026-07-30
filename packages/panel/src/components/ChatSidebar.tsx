'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { VaultWordmark } from './Logo';

export interface ConversationItem {
  id: string;
  title: string;
  model?: string | null;
  provider?: string | null;
  updatedAt: Date | string;
}

function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const NAV = [
  {
    href: '/chat',
    label: 'Sanctum',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h6v6H4V5zm10 0h6v6h-6V5zM4 13h6v6H4v-6zm10 0h6v6h-6v-6z" />
      </svg>
    ),
  },
  {
    href: '/settings/keys',
    label: 'The Vault',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V7l8-4z" />
      </svg>
    ),
  },
  {
    href: '/settings/audit',
    label: 'Chronicles',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h11a2 2 0 012 2v14l-3-2-3 2-3-2-3 2V6a2 2 0 012-2z" />
      </svg>
    ),
  },
] as const;

export function ChatSidebar({
  conversations,
  activeId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
}: {
  conversations: ConversationItem[];
  activeId: string | null;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation?: (id: string) => void;
  onRenameConversation?: (id: string, title: string) => void;
}) {
  const pathname = usePathname();
  const [search, setSearch] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const filtered = search
    ? conversations.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
    : conversations;

  return (
    <div className="flex flex-col h-full bg-precious-bg/80 border-r border-precious-emerald/30">
      <div className="px-4 pt-5 pb-3">
        <VaultWordmark />
      </div>

      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={onNewChat}
          className="precious-btn-primary w-full text-sm py-2.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Whisper
        </button>
      </div>

      <nav className="px-2 pb-2 space-y-0.5">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? 'bg-precious-emerald/40 text-precious-gold-bright border-l-2 border-precious-gold'
                  : 'text-precious-muted hover:bg-precious-surface/50 hover:text-precious-text border-l-2 border-transparent'
              }`}
            >
              <span className={active ? 'text-precious-gold' : ''}>{item.icon}</span>
              <span className="font-medium tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 border-t border-precious-emerald/40" />

      <div className="flex-1 flex flex-col min-h-0 pt-3">
        <div className="px-3 pb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-precious-muted/70">
            Temporal Logs
          </span>
        </div>

        <div className="px-3 pb-2">
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-precious-muted/50"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
            <input
              type="text"
              placeholder="Scan recent secrets…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-md text-xs bg-precious-surface-low/80 border border-precious-emerald/40 text-precious-text placeholder:text-precious-muted/40 focus:outline-none focus:border-precious-gold/50"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
          {filtered.length === 0 && (
            <p className="text-xs text-precious-muted/50 px-3 py-6 text-center">
              {search ? 'No matching whispers' : 'No temporal logs yet'}
            </p>
          )}
          {filtered.map((conv) => {
            const isActive = conv.id === activeId;
            const isRenaming = renamingId === conv.id;

            if (isRenaming) {
              return (
                <div key={conv.id} className="group relative">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => {
                      if (renameValue.trim() && renameValue.trim() !== conv.title) {
                        onRenameConversation?.(conv.id, renameValue.trim());
                      }
                      setRenamingId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (renameValue.trim() && renameValue.trim() !== conv.title) {
                          onRenameConversation?.(conv.id, renameValue.trim());
                        }
                        setRenamingId(null);
                      }
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    autoFocus
                    className="w-full px-3 py-2 rounded-md text-xs bg-precious-surface border border-precious-gold/40 text-precious-text outline-none"
                  />
                </div>
              );
            }

            return (
              <div key={conv.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onSelectConversation(conv.id)}
                  onDoubleClick={() => {
                    if (onRenameConversation) {
                      setRenamingId(conv.id);
                      setRenameValue(conv.title);
                    }
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                    isActive
                      ? 'bg-precious-emerald/45 text-precious-text border border-precious-gold/35'
                      : 'text-precious-muted hover:bg-precious-surface/60 hover:text-precious-text/90 border border-transparent'
                  }`}
                >
                  <div className="text-xs font-medium truncate">{conv.title}</div>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-precious-muted/60">
                    <span>{formatTime(conv.updatedAt)}</span>
                    {conv.model && <span>{conv.model}</span>}
                  </div>
                </button>
                {onDeleteConversation && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(conv.id);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-[10px] text-red-400/60 hover:text-red-400 transition-opacity p-1"
                    title="Delete conversation"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-auto border-t border-precious-emerald/40 px-4 py-3 flex items-center gap-3">
        <div className="h-8 w-8 rounded-full border border-precious-gold/40 bg-precious-surface flex items-center justify-center text-precious-gold">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4 0-7 2-7 4v1h14v-1c0-2-3-4-7-4z"
            />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-precious-text truncate">Local Warden</div>
          <div className="flex items-center gap-1.5 text-[10px] text-precious-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 vault-pulse" />
            Shield active
          </div>
        </div>
      </div>
    </div>
  );
}
