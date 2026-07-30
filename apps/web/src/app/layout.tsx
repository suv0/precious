import type { Metadata } from 'next';
import './globals.css';
import '@precious/panel/styles.css';
import { LocalPanelProvider } from '@/components/LocalPanelProvider';

export const metadata: Metadata = {
  title: 'Precious Local — The Vault',
  description: 'Self-hosted LLM router. Seal keys, whisper in Sanctum, forge a prec_ API key.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LocalPanelProvider>{children}</LocalPanelProvider>
      </body>
    </html>
  );
}
