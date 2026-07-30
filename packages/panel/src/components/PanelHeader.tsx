'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from './Logo';
import { usePanelConfig } from '../config';

const NAV = [
  { href: '/chat', label: 'Sanctum' },
  { href: '/settings/keys', label: 'The Vault' },
  { href: '/settings/audit', label: 'Chronicles' },
] as const;

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
    ...NAV,
    ...(showDocsLink ? [{ href: '/docs', label: 'Docs' }] : []),
  ];

  return (
    <header className="border-b border-precious-emerald/40 px-4 py-3 lg:px-6 lg:py-4 bg-precious-bg/60 backdrop-blur-md">
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
            <nav className="hidden sm:flex items-center gap-5">
              {nav.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`text-sm tracking-wide transition-colors ${
                      active
                        ? 'nav-active font-semibold'
                        : 'text-precious-muted hover:text-precious-text'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
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
