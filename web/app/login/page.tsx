'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { validatePassword, validatePhone } from '@/lib/auth-utils';

export default function LoginPage() {
  const router = useRouter();
  const { signUpPhone, signInPhone, signInGoogle } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePhoneAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!phone || !password) {
      setError('Phone and password are required');
      setLoading(false);
      return;
    }

    const phoneVal = validatePhone(phone);
    if (!phoneVal.valid) {
      setError(phoneVal.error || 'Invalid phone');
      setLoading(false);
      return;
    }

    const passVal = validatePassword(password);
    if (!passVal.valid) {
      setError(passVal.error || 'Invalid password');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        await signUpPhone(phone, password);
      } else {
        await signInPhone(phone, password);
      }
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
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
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-center mb-6 text-slate-900">Sign In</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handlePhoneAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1234567890"
              className="w-full px-3 py-2 border rounded-lg text-slate-900 placeholder-slate-400"
              disabled={loading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Password (letters & numbers only)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              className="w-full px-3 py-2 border rounded-lg text-slate-900 placeholder-slate-400"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-600 text-white py-2 rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <div className="my-4 text-center text-sm text-slate-600">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-teal-600 hover:underline"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </div>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-slate-500">Or</span>
          </div>
        </div>

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full bg-white border border-slate-300 text-slate-900 py-2 rounded-lg font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          Continue with Google
        </button>

        <div className="mt-6 text-center text-xs text-slate-600">
          <a href="/terms" className="hover:underline">Terms of Use</a> • <a href="/about" className="hover:underline">About</a>
        </div>
      </div>
    </div>
  );
}
