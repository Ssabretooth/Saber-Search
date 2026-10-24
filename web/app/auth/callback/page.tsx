'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? '/profile' : '/login');
  }, [loading, user, router]);

  return <p className="p-8 text-center text-slate-600">Signing you in…</p>;
}
