'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { PanelProvider, type PanelConfig } from '@precious/panel';
import { ShellLayout } from './ShellLayout';

const localPanelConfig: PanelConfig = {
  requireAuth: false,
  showDocsLink: true,
  legalLinks: undefined,
};

function SuspendedShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ShellLayout>{children}</ShellLayout>
    </Suspense>
  );
}

export function LocalPanelProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <PanelProvider config={localPanelConfig}>
      {pathname === '/' ? (
        <>{children}</>
      ) : (
        <SuspendedShell>{children}</SuspendedShell>
      )}
    </PanelProvider>
  );
}
