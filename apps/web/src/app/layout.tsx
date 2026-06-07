import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Precious — One key to rule them all',
  description: 'Every LLM. Your keys. Our router. Cloud or local.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
