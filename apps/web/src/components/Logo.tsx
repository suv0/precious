import Link from 'next/link';
import { Logo as PanelLogo } from '@precious/panel';

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const scale = size === 'sm' ? 'scale-90' : size === 'lg' ? 'scale-110' : '';
  return (
    <span className={`inline-flex ${scale}`}>
      <PanelLogo href="/" />
    </span>
  );
}

/** Docs/footer wordmark when PanelLogo import path is heavy — keep thin alias above. */
export function DocsHomeLink() {
  return (
    <Link href="/" className="font-display font-semibold text-precious-gold tracking-wide uppercase text-sm">
      Precious
    </Link>
  );
}
