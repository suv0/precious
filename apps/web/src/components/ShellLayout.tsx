'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PanelLayout } from '@precious/panel';
import { ChatSidebar, type ConversationItem } from '@precious/panel';
import { apiFetch } from '@precious/panel';

export function ShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const activeId = pathname === '/chat' ? searchParams.get('conversationId') : null;

  const loadConversations = useCallback(async () => {
    try {
      const r = await apiFetch<{ conversations: ConversationItem[] }>('/api/chat/conversations');
      setConversations(r.conversations);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations, refreshKey]);

  // Listen for refresh requests from child pages
  useEffect(() => {
    const handler = () => setRefreshKey((k) => k + 1);
    window.addEventListener('precious:refresh-conversations', handler);
    return () => window.removeEventListener('precious:refresh-conversations', handler);
  }, []);

  const handleNewChat = () => {
    router.push('/chat');
  };

  const handleSelectConversation = (cid: string) => {
    router.push(`/chat?conversationId=${cid}`);
  };

  const handleDeleteConversation = async (cid: string) => {
    try {
      await apiFetch(`/api/chat/conversations/${cid}`, { method: 'DELETE' });
      setConversations((prev) => prev.filter((c) => c.id !== cid));
      if (cid === activeId) {
        handleNewChat();
      }
    } catch {
      /* silent */
    }
  };

  const handleRenameConversation = async (id: string, title: string) => {
    try {
      await apiFetch(`/api/chat/conversations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title }),
      });
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title } : c)),
      );
    } catch {
      /* silent */
    }
  };

  return (
    <PanelLayout
      sidebar={
        <ChatSidebar
          conversations={conversations}
          activeId={activeId}
          onNewChat={handleNewChat}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
          onRenameConversation={handleRenameConversation}
        />
      }
    >
      {children}
    </PanelLayout>
  );
}
