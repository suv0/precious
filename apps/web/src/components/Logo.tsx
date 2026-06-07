import Link from 'next/link';

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'text-lg', md: 'text-2xl', lg: 'text-4xl' };
  return (
    <Link href="/" className={`font-display font-bold text-precious-gold gold-glow ${sizes[size]} flex items-center gap-2`}>
      <span className="text-2xl">💎</span>
      Precious
    </Link>
  );
}
