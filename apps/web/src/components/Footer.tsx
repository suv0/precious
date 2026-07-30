import Link from 'next/link';
import { Logo } from './Logo';

const links = [
  { href: '/docs', label: 'Docs' },
  { href: '/chat', label: 'Sanctum' },
  { href: '/settings/keys', label: 'The Vault' },
  { href: '/settings/audit', label: 'Chronicles' },
  { href: 'https://github.com/suv0/precious', label: 'GitHub', external: true },
];

export function Footer() {
  return (
    <footer className="border-t border-precious-emerald/40 mt-auto py-10 px-6">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between gap-6">
        <div>
          <Logo size="sm" />
          <p className="text-precious-muted text-sm mt-2 max-w-md">
            One key to LLM them all — your providers, encrypted at rest.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-precious-muted">
          {links.map((l) =>
            l.external ? (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-precious-gold transition-colors"
              >
                {l.label}
              </a>
            ) : (
              <Link key={l.href} href={l.href} className="hover:text-precious-gold transition-colors">
                {l.label}
              </Link>
            ),
          )}
        </nav>
      </div>
    </footer>
  );
}
