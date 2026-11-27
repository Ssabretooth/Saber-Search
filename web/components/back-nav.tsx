"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

interface BackNavProps {
  href?: string;
  label?: string;
}

export function BackNav({ href, label = "Back" }: BackNavProps) {
  const router = useRouter();

  if (href) {
    return (
      <Link
        href={href}
        className="mb-10 inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-700"
      >
        <ArrowLeft size={14} />
        {label}
      </Link>
    );
  }

  return (
    <button
      onClick={() => router.back()}
      className="mb-10 inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-700"
    >
      <ArrowLeft size={14} />
      {label}
    </button>
  );
}
