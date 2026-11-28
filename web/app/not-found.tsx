import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col gap-4 py-16 max-w-md">
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">404</p>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">
        Record not found
      </h1>
      <p className="text-sm text-slate-500 leading-relaxed">
        This profile or page does not exist in the public records database.
        It may have been removed or the link may be incorrect.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
      >
        Back to PublikEye
      </Link>
    </div>
  );
}
