'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [providerError, setProviderError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search + window.location.hash.replace('#', '&'));
    setProviderError(params.get('error_description') ?? params.get('error'));
  }, []);

  useEffect(() => {
    if (!loading && user) router.replace('/profile');
  }, [loading, user, router]);

  if (loading || user) {
    return <p className="p-8 text-center text-slate-600">Signing you in…</p>;
  }

  return (
    <div className="mx-auto max-w-md space-y-4 p-8 text-center">
      <p className="text-red-700">
        {providerError ? `Sign-in failed: ${providerError}` : 'Sign-in did not complete. Please try again.'}
      </p>
      <Link href="/login" className="font-medium text-teal-600 hover:underline">Back to sign in</Link>
    </div>
  );
}
