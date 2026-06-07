'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageLayout } from '@/components/PageLayout';
import { apiFetch } from '@/lib/api';
import { isLocalMode } from '@/lib/mode';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [authRequired, setAuthRequired] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLocalMode()) {
      apiFetch<{ authRequired?: boolean }>('/api/auth/status')
        .then((s) => {
          if (!s.authRequired) {
            router.replace('/settings/keys');
            return;
          }
          setAuthRequired(true);
        })
        .catch(() => router.replace('/settings/keys'))
        .finally(() => setLoading(false));
      return;
    }

    apiFetch<{ authRequired?: boolean; setupRequired?: boolean }>('/api/auth/status')
      .then((s) => setAuthRequired(s.authRequired ?? s.setupRequired ?? true))
      .catch(() => setAuthRequired(true))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ password }) });
      router.push('/settings/keys');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  }

  if (loading) {
    return (
      <PageLayout>
        <div className="max-w-md mx-auto px-6 py-16 text-center text-precious-muted">
          Loading.
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="max-w-md mx-auto px-6 py-16">
        <h1 className="font-display text-3xl text-precious-gold text-center mb-2">
          Welcome back
        </h1>
        <p className="text-precious-muted text-center mb-8 text-sm">
          {authRequired
            ? 'Local mode with password protection enabled (PRECIOUS_LOCAL_PASSWORD).'
            : 'Enter your local password to continue.'}
        </p>

        <form onSubmit={handleSubmit} className="precious-card p-6 space-y-4">
          <div>
            <label className="block text-sm text-precious-muted mb-1">Password</label>
            <input
              type="password"
              className="precious-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" className="precious-btn-primary w-full" disabled={loading}>
            Login
          </button>
        </form>
      </div>
    </PageLayout>
  );
}
