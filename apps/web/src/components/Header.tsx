'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from './Logo';
import { isLocalMode } from '@/lib/mode';

const nav = [
  { href: '/chat', label: 'Sanctum' },
  { href: '/settings/keys', label: 'The Vault' },
  { href: '/settings/audit', label: 'Chronicles' },
  { href: '/docs', label: 'Docs' },
];

export function Header() {
  const pathname = usePathname();
  const local = isLocalMode();

  return (
    <header className="border-b border-precious-emerald/40 px-6 py-4 bg-precious-bg/60 backdrop-blur-md">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Logo />
        <nav className="flex items-center gap-6">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm transition-colors ${
                pathname.startsWith(item.href)
                  ? 'nav-active font-semibold'
                  : 'text-precious-muted hover:text-precious-text'
              }`}
            >
              {item.label}
            </Link>
          ))}
          {!local && (
            <Link href="/login" className="precious-btn-gold text-sm py-1.5 px-3">
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
