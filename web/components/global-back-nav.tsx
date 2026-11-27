"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

const ROOT_PATHS = new Set(["/", "/login", "/signup", "/auth/callback"]);

export function GlobalBackNav() {
  const pathname = usePathname();
  const router = useRouter();

  if (ROOT_PATHS.has(pathname)) return null;

  return (
    <div className="mb-6">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-700"
      >
        <ArrowLeft size={14} />
        Back
      </button>
    </div>
  );
}
