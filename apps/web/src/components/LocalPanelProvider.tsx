'use client';

import { PanelProvider, type PanelConfig } from '@precious/panel';

const localPanelConfig: PanelConfig = {
  requireAuth: false,
  showDocsLink: true,
  legalLinks: undefined,
};

export function LocalPanelProvider({ children }: { children: React.ReactNode }) {
  return <PanelProvider config={localPanelConfig}>{children}</PanelProvider>;
}
