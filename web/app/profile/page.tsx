'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { validatePhone } from '@/lib/auth-utils';
import { FormField } from '@/components/FormField';

const providerLabel = { email: 'Email', google: 'Google', github: 'GitHub' } as const;

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, loading, updateProfile, signOut } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.first_name ?? '');
    setLastName(profile.last_name ?? '');
    setPhone(profile.phone ?? '');
  }, [profile]);

  if (loading || !user) {
    return <p className="p-8 text-center text-slate-600">Loading…</p>;
  }

  const initials = [profile?.first_name?.[0], profile?.last_name?.[0]].filter(Boolean).join('').toUpperCase()
    || user.email?.[0]?.toUpperCase() || '?';
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);
    const cleanPhone = phone.replace(/[\s()-]/g, '');
    if (!firstName.trim() || !lastName.trim()) return setMessage({ type: 'error', text: 'Name and surname are required' });
    const phoneCheck = validatePhone(cleanPhone);
    if (!phoneCheck.valid) return setMessage({ type: 'error', text: phoneCheck.error ?? 'Invalid phone number' });

    setSaving(true);
    try {
      await updateProfile({ first_name: firstName.trim(), last_name: lastName.trim(), phone: cleanPhone });
      setMessage({ type: 'ok', text: 'Profile saved' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Could not save profile' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-blue-600 text-xl font-bold text-white">
          {initials}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-slate-900">{fullName || 'Your profile'}</h1>
          <p className="truncate text-sm text-slate-600">{user.email}</p>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-3 rounded-xl border bg-white p-5 text-sm sm:grid-cols-3">
        <div><dt className="text-slate-500">Sign-in method</dt><dd className="font-medium text-slate-900">{providerLabel[profile?.auth_provider ?? 'email']}</dd></div>
        <div><dt className="text-slate-500">Role</dt><dd className="font-medium capitalize text-slate-900">{profile?.role ?? 'user'}</dd></div>
        <div><dt className="text-slate-500">Member since</dt><dd className="font-medium text-slate-900">{new Date(user.created_at).toLocaleDateString('en-ZA')}</dd></div>
      </dl>

      <form onSubmit={handleSave} className="space-y-4 rounded-xl border bg-white p-5">
        <h2 className="font-semibold text-slate-900">Personal details</h2>
        {!profile?.phone && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Add your phone number to complete your profile.</p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={saving} required />
          <FormField label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={saving} required />
        </div>
        <FormField label="Phone number" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={saving} required />
        {message && (
          <p role="status" className={message.type === 'ok' ? 'text-sm text-teal-700' : 'text-sm text-red-700'}>{message.text}</p>
        )}
        <button type="submit" disabled={saving} className="rounded-lg bg-teal-600 px-5 py-2.5 font-medium text-white hover:bg-teal-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      <button
        onClick={async () => { await signOut(); router.replace('/'); }}
        className="w-full rounded-lg border py-2.5 font-medium text-slate-700 hover:bg-slate-50"
      >
        Sign out
      </button>
    </div>
  );
}
