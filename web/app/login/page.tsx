'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { FormField } from '@/components/FormField';
import { AuthShell, Divider } from '@/components/AuthShell';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signInGoogle, user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) router.replace('/profile');
  }, [authLoading, user, router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.push('/profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    try {
      await signInGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    }
  };

  return (
    <AuthShell title="Sign in" error={error}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} required />
        <FormField label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} required />
        <button type="submit" disabled={loading} className="w-full rounded-lg bg-teal-600 py-2.5 font-medium text-white hover:bg-teal-700 disabled:opacity-50">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <Divider />

      <button onClick={handleGoogle} className="w-full rounded-lg border bg-white py-2.5 font-medium text-slate-900 hover:bg-slate-50">
        Continue with Google
      </button>

      <p className="mt-6 text-center text-sm text-slate-600">
        New here?{' '}
        <Link href="/signup" className="font-medium text-teal-600 hover:underline">Create an account</Link>
      </p>
    </AuthShell>
  );
}
