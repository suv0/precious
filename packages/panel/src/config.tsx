'use client';

import { createContext, useContext } from 'react';

export interface LegalLinks {
  security: string;
  privacy: string;
  legal: string;
}

export interface PanelConfig {
  /** Empty string = same-origin (Next rewrites) */
  apiBase?: string;
  requireAuth: boolean;
  legalLinks?: LegalLinks;
  onAuthRequired?: () => void;
  showDocsLink?: boolean;
  loginHref?: string;
}

const PanelConfigContext = createContext<PanelConfig>({
  requireAuth: false,
  showDocsLink: true,
});

export function PanelProvider({
  config,
  children,
}: {
  config: PanelConfig;
  children: React.ReactNode;
}) {
  return (
    <PanelConfigContext.Provider value={config}>{children}</PanelConfigContext.Provider>
  );
}

export function usePanelConfig(): PanelConfig {
  return useContext(PanelConfigContext);
}
