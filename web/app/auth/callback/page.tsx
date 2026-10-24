'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const providerError =
      url.searchParams.get('error_description') ?? url.searchParams.get('error') ??
      hash.get('error_description') ?? hash.get('error');
    if (providerError) {
      setError(providerError);
      return;
    }
    if (!url.searchParams.get('code')) {
      setError(`No sign-in code received. Landed on ${url.pathname}${url.search ? ' with query' : ''}${url.hash ? ' with hash' : ''}.`);
      return;
    }
    getSupabase()
      .auth.exchangeCodeForSession(url.href)
      .then(({ error }) => {
        if (error) setError(error.message);
        else router.replace('/profile');
      });
  }, [router]);

  if (error) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-8 text-center">
        <p className="text-red-700">Sign-in failed: {error}</p>
        <Link href="/login" className="font-medium text-teal-600 hover:underline">Back to sign in</Link>
      </div>
    );
  }

  return <p className="p-8 text-center text-slate-600">Signing you in…</p>;
}
