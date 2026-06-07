import Link from 'next/link';
import { Logo } from './Logo';

const links = [
  { href: '/security', label: 'Security' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/legal', label: 'Legal / ToS' },
  { href: '/limitations', label: 'Limitations' },
  { href: '/local', label: 'Run Local' },
  { href: '/docs', label: 'Docs' },
];

export function Footer() {
  return (
    <footer className="border-t border-emerald-900/40 mt-auto py-10 px-6">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between gap-6">
        <div>
          <Logo size="sm" />
          <p className="text-precious-muted text-sm mt-2 max-w-md">
            One key to LLM them all — tokens sold separately, providers not included.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-precious-muted">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-precious-gold transition-colors">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
