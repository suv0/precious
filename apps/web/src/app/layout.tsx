import type { Metadata } from 'next';
import './globals.css';
import '@precious/panel/styles.css';
import { LocalPanelProvider } from '@/components/LocalPanelProvider';

export const metadata: Metadata = {
  title: 'Precious Local — Keys & Chat',
  description: 'Self-hosted LLM router panel. Add keys, chat, unified prec_ API key.',
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
