import Link from 'next/link';
import { PageLayout } from '@/components/PageLayout';

export default function NotFound() {
  return (
    <PageLayout showHeader={false}>
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
        <div className="text-6xl mb-4">🚪</div>
        <h1 className="font-display text-4xl text-precious-gold gold-glow mb-4">404</h1>
        <p className="text-xl text-precious-muted italic mb-8 max-w-md">
          You shall not pass… without a valid API key.
        </p>
        <Link href="/" className="precious-btn-primary">
          Return to the Shire
        </Link>
      </div>
    </PageLayout>
  );
}
