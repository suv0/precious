import Link from 'next/link';

function ShieldMark({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M16 3L6 7.5V15c0 7.2 4.2 11.8 10 14 5.8-2.2 10-6.8 10-14V7.5L16 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="14" r="3.2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M16 17.2V21"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({ href = '/chat' }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 group">
      <span className="text-precious-gold group-hover:text-precious-gold-bright transition-colors">
        <ShieldMark />
      </span>
      <span className="font-display text-lg font-semibold tracking-[0.12em] uppercase text-precious-gold group-hover:gold-glow transition-all">
        Precious
      </span>
    </Link>
  );
}

export function VaultWordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-precious-gold">
        <ShieldMark className="h-6 w-6" />
      </span>
      <span className="font-display text-base font-semibold tracking-[0.18em] uppercase text-precious-gold">
        The Vault
      </span>
    </div>
  );
}
