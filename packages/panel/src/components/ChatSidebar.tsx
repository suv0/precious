'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from './Logo';

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
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(search.toLowerCase()),
      )
    : conversations;

  const navItems = [
    { href: '/chat', label: 'Chat', icon: '💬' },
    { href: '/settings/keys', label: 'Keys', icon: '🔑' },
    { href: '/settings/audit', label: 'Audit', icon: '📋' },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-2">
        <Logo />
      </div>

      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-emerald-800/60 hover:bg-emerald-700/60 text-emerald-100 border border-emerald-700/40 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Chat
        </button>
      </div>

      <nav className="px-2 pb-2 space-y-0.5">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? 'bg-emerald-900/40 text-precious-gold'
                  : 'text-precious-muted hover:bg-emerald-950/30 hover:text-precious-text'
              }`}
            >
              <span className="w-5 text-center text-xs">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 border-t border-emerald-900/40" />

      <div className="flex-1 flex flex-col min-h-0 pt-2">
        <div className="px-3 pb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-precious-muted/60">
            Recents
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Search recents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-md text-xs bg-emerald-950/50 border border-emerald-900/40 text-precious-text placeholder:text-precious-muted/40 focus:outline-none focus:border-emerald-700/60"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
          {filtered.length === 0 && (
            <p className="text-xs text-precious-muted/50 px-3 py-6 text-center">
              {search ? 'No matching conversations' : 'No conversations yet'}
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
                    className="w-full px-3 py-2 rounded-md text-xs bg-emerald-950/70 border border-emerald-700/50 text-precious-text outline-none"
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
                      ? 'bg-emerald-900/50 text-precious-text'
                      : 'text-precious-muted hover:bg-emerald-950/40 hover:text-precious-text/80'
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
                    x
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
