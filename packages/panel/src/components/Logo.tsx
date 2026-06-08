import Link from 'next/link';

export function Logo() {
  return (
    <Link href="/settings/keys" className="flex items-center gap-2 group">
      <span className="text-2xl">💍</span>
      <span className="font-display text-xl font-semibold text-precious-gold group-hover:gold-glow transition-all">
        Precious
      </span>
    </Link>
  );
}
