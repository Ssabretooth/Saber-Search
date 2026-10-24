'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { validatePassword, validatePhone } from '@/lib/auth-utils';
import { FormField } from '@/components/FormField';
import { AuthShell, Divider } from '@/components/AuthShell';

const initial = { firstName: '', lastName: '', email: '', confirmEmail: '', phone: '', password: '', confirmPassword: '' };

export default function SignUpPage() {
  const router = useRouter();
  const { signUp, signInGoogle } = useAuth();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const set = (key: keyof typeof initial) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = (): string | null => {
    if (!form.firstName.trim() || !form.lastName.trim()) return 'Please enter your first and last name';
    if (form.email.trim().toLowerCase() !== form.confirmEmail.trim().toLowerCase()) return 'Email addresses do not match';
    const phoneCheck = validatePhone(cleanPhone(form.phone));
    if (!phoneCheck.valid) return phoneCheck.error ?? 'Invalid phone number';
    const passCheck = validatePassword(form.password);
    if (!passCheck.valid) return passCheck.error ?? 'Invalid password';
    if (form.password !== form.confirmPassword) return 'Passwords do not match';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const problem = validate();
    if (problem) return setError(problem);

    setLoading(true);
    try {
      const { needsConfirmation } = await signUp({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: cleanPhone(form.phone),
        password: form.password,
      });
      if (needsConfirmation) setSent(true);
      else router.push('/profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    try {
      await signInGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-up failed');
    }
  };

  if (sent) {
    return (
      <AuthShell title="Check your email">
        <p className="text-center text-slate-600">
          We sent a confirmation link to <span className="font-medium text-slate-900">{form.email}</span>. Confirm it to activate your account, then sign in.
        </p>
        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="font-medium text-teal-600 hover:underline">Go to sign in</Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create account" error={error}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="First name" autoComplete="given-name" value={form.firstName} onChange={set('firstName')} disabled={loading} required />
          <FormField label="Last name" autoComplete="family-name" value={form.lastName} onChange={set('lastName')} disabled={loading} required />
        </div>
        <FormField label="Email" type="email" autoComplete="email" value={form.email} onChange={set('email')} disabled={loading} required />
        <FormField label="Confirm email" type="email" autoComplete="off" value={form.confirmEmail} onChange={set('confirmEmail')} disabled={loading} required />
        <FormField label="Phone number" type="tel" autoComplete="tel" placeholder="+27 82 123 4567" value={form.phone} onChange={set('phone')} disabled={loading} required />
        <FormField label="Password (letters and numbers, min 6)" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} disabled={loading} required />
        <FormField label="Confirm password" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={set('confirmPassword')} disabled={loading} required />
        <button type="submit" disabled={loading} className="w-full rounded-lg bg-teal-600 py-2.5 font-medium text-white hover:bg-teal-700 disabled:opacity-50">
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <Divider />

      <button onClick={handleGoogle} className="w-full rounded-lg border bg-white py-2.5 font-medium text-slate-900 hover:bg-slate-50">
        Sign up with Google
      </button>

      <p className="mt-6 text-center text-sm text-slate-600">
        Already registered?{' '}
        <Link href="/login" className="font-medium text-teal-600 hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}

function cleanPhone(phone: string) {
  return phone.replace(/[\s()-]/g, '');
}
