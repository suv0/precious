'use client';

import { usePathname } from 'next/navigation';
import { PanelProvider, type PanelConfig } from '@precious/panel';
import { ShellLayout } from './ShellLayout';

const localPanelConfig: PanelConfig = {
  requireAuth: false,
  showDocsLink: true,
  legalLinks: undefined,
};

export function LocalPanelProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <PanelProvider config={localPanelConfig}>
      {pathname === '/' ? (
        <>{children}</>
      ) : (
        <ShellLayout>{children}</ShellLayout>
      )}
    </PanelProvider>
  );
}
