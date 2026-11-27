"use client";

import Link from "next/link";
import { Users, FileText, Search, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const categories = [
  {
    id: "members",
    title: "Members of Parliament",
    description: "Explore profiles of all sitting MPs",
    icon: Users,
    href: "/members",
  },
  {
    id: "disclosures",
    title: "Financial Disclosures",
    description: "Track declared interests and assets",
    icon: FileText,
    href: "/disclosures",
  },
  {
    id: "tenders",
    title: "Follow the Tender",
    description: "Government contracts linked to declared interests",
    icon: Search,
    href: "/members",
  },
  {
    id: "flags",
    title: "Alerts and Flags",
    description: "Notable patterns and observations",
    icon: AlertCircle,
    href: "/flags",
  },
];

export default function HomePage() {
  const { user, profile, loading } = useAuth();

  return (
    <div className="flex min-h-[calc(100vh-3rem)] max-w-4xl flex-col">
      {/* Welcome */}
      <div className="mb-10">
        <h1 className="mb-3 text-2xl font-bold tracking-tight text-slate-900">
          {user && profile?.first_name
            ? `Welcome back, ${profile.first_name}.`
            : "Welcome to PublikEye"}
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-slate-500">
          We believe in <strong className="text-slate-700">open democracy</strong> and{" "}
          <strong className="text-slate-700">accountability</strong>. PublikEye tracks how state
          resources and public funds are used by members of parliament. All information here is{" "}
          <strong className="text-slate-700">publicly available</strong>. We simply make it findable.
        </p>
        {!loading && !user && (
          <div className="mt-7 flex gap-3">
            <Link
              href="/signup"
              className="rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
            >
              Create an account
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-stone-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-stone-50"
            >
              Sign in
            </Link>
          </div>
        )}
      </div>

      {/* Category cards — authenticated only */}
      {user && (
        <>
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Explore
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <Link
                  key={cat.id}
                  href={cat.href}
                  className="group rounded-lg border border-stone-200 bg-white p-5 transition-all hover:border-teal-300 hover:shadow-sm"
                >
                  <div className="flex h-full flex-col gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 transition-colors group-hover:bg-teal-100">
                      <Icon className="text-teal-600" size={18} />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 transition-colors group-hover:text-teal-700">
                      {cat.title}
                    </h3>
                    <p className="text-xs leading-relaxed text-slate-500">{cat.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {/* Footer — pinned to bottom */}
      <footer className="mt-auto border-t border-stone-200 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-700">PublikEye</p>
            <p className="text-xs italic text-slate-400">We simply make it findable.</p>
          </div>
          <nav className="flex gap-5">
            <Link href="/terms" className="text-xs text-slate-400 hover:text-slate-600">Terms</Link>
            <Link href="/about" className="text-xs text-slate-400 hover:text-slate-600">About</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
