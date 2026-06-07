import Link from 'next/link';
import { PageLayout } from '@/components/PageLayout';

export default function SignupPage() {
  return (
    <PageLayout>
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <h1 className="font-display text-3xl text-precious-gold mb-4">Hosted signup</h1>
        <div className="precious-card p-8 space-y-4">
          <p className="text-precious-muted">
            Cloud signup (Auth.js, multi-tenant) is part of the separate hosted product and is not available in this self-host build.
          </p>
          <p className="text-precious-muted text-sm">
            Use <strong className="text-precious-text">Precious Local</strong> from this repository — fully supported today.
          </p>
          <Link href="/local" className="precious-btn-primary inline-flex">
            Run Local instead
          </Link>
          <Link href="/settings/keys" className="block text-precious-gold text-sm hover:underline mt-4">
            Go to keys (local)
          </Link>
        </div>
      </div>
    </PageLayout>
  );
}
