'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from './Logo';
import { usePanelConfig } from '../config';

export function PanelHeader({
  sidebarToggle,
  showNav,
}: {
  sidebarToggle?: () => void;
  showNav?: boolean;
}) {
  const pathname = usePathname();
  const { requireAuth, loginHref, showDocsLink } = usePanelConfig();

  const nav = [
    { href: '/chat', label: 'Chat' },
    { href: '/settings/keys', label: 'Keys' },
    { href: '/settings/audit', label: 'Audit' },
    ...(showDocsLink ? [{ href: '/docs', label: 'Docs' }] : []),
  ];

  return (
    <header className="border-b border-emerald-900/40 px-4 py-3 lg:px-6 lg:py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {sidebarToggle && (
            <button
              type="button"
              onClick={sidebarToggle}
              className="lg:hidden text-precious-muted hover:text-precious-gold p-1"
              aria-label="Toggle sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          <Logo />
        </div>
        <div className="flex items-center gap-6">
          {showNav && (
            <nav className="flex items-center gap-4">
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
            </nav>
          )}
          {requireAuth && loginHref && (
            <Link href={loginHref} className="precious-btn-gold text-sm py-1.5 px-3">
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
