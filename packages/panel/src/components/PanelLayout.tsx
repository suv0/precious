'use client';

import { useState } from 'react';
import { PanelHeader } from './PanelHeader';

export function PanelLayout({
  children,
  sidebar,
  showHeader = true,
}: {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  showHeader?: boolean;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen">
      {sidebar && (
        <>
          {/* Mobile overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/60 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
          {/* Sidebar */}
          <aside
            className={`fixed inset-y-0 left-0 z-50 w-[280px] border-r border-emerald-900/40 bg-precious-bg flex flex-col transform transition-transform duration-200 lg:relative lg:translate-x-0 ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            {sidebar}
          </aside>
        </>
      )}
      <div className="flex flex-col flex-1 min-w-0">
        {showHeader && (
          <PanelHeader
            sidebarToggle={sidebar ? () => setSidebarOpen(!sidebarOpen) : undefined}
            showNav={!sidebar}
          />
        )}
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
