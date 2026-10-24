'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AdminLoginPage() {
  const router = useRouter();
  const { signInGitHub } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGitHub = async () => {
    setError('');
    setLoading(true);
    try {
      await signInGitHub();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'GitHub sign-in failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-center mb-2 text-slate-900">Admin Portal</h1>
        <p className="text-center text-sm text-slate-600 mb-6">GitHub authentication required</p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          onClick={handleGitHub}
          disabled={loading}
          className="w-full bg-slate-900 text-white py-3 rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? 'Connecting...' : '✓ Sign in with GitHub'}
        </button>

        <div className="mt-6 pt-6 border-t border-slate-200 text-center text-xs text-slate-600">
          <a href="/login" className="text-teal-600 hover:underline">Back to user login</a>
        </div>
      </div>
    </div>
  );
}
