'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from './Logo';
import { usePanelConfig } from '../config';

export function PanelHeader() {
  const pathname = usePathname();
  const { requireAuth, loginHref, showDocsLink } = usePanelConfig();

  const nav = [
    { href: '/chat', label: 'Chat' },
    { href: '/settings/keys', label: 'Keys' },
    { href: '/settings/audit', label: 'Audit' },
    ...(showDocsLink ? [{ href: '/docs', label: 'Docs' }] : []),
  ];

  return (
    <header className="border-b border-emerald-900/40 px-6 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Logo />
        <nav className="flex items-center gap-6">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm transition-colors ${
                pathname.startsWith(item.href)
                  ? 'text-precious-gold'
                  : 'text-precious-muted hover:text-precious-text'
              }`}
            >
              {item.label}
            </Link>
          ))}
          {requireAuth && loginHref && (
            <Link href={loginHref} className="precious-btn-gold text-sm py-1.5 px-3">
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
