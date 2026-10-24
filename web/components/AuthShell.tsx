import Link from 'next/link';

export function AuthShell({ title, error, children }: { title: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
        <h1 className="mb-6 text-center text-2xl font-bold text-slate-900">{title}</h1>
        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {children}
        <p className="mt-6 text-center text-xs text-slate-500">
          <Link href="/terms" className="hover:underline">Terms</Link> · <Link href="/about" className="hover:underline">About</Link>
        </p>
      </div>
    </div>
  );
}

export function Divider() {
  return (
    <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
      <span className="h-px flex-1 bg-slate-200" />
      or
      <span className="h-px flex-1 bg-slate-200" />
    </div>
  );
}
