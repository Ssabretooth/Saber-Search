"use client";

import Link from "next/link";
import Image from "next/image";
import { User, FileText, Search, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const categories = [
  {
    id: "members",
    title: "Members of Parliament",
    description: "Explore profiles of all members",
    icon: User,
    href: "/members",
  },
  {
    id: "disclosures",
    title: "Financial Disclosures",
    description: "Track declared interests and assets",
    icon: FileText,
    href: "/members",
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
    title: "Alerts & Flags",
    description: "Notable patterns and observations",
    icon: AlertCircle,
    href: "/flags",
  },
];

export default function HomePage() {
  const { user, profile, loading } = useAuth();
  const initials =
    profile?.first_name && profile?.last_name
      ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
      : user?.email?.[0]?.toUpperCase();

  return (
    <div>
      {/* Header */}
      <header className="flex items-center justify-between gap-2 border-b border-stone-200 pb-4">
        <Link href="/" className="flex w-10 shrink-0 items-center gap-2 sm:w-40">
          <Image src="/logo.jpg" alt="PublikEye" width={40} height={40} className="rounded-lg" />
          <span className="hidden text-sm font-semibold text-slate-900 sm:inline">PublikEye</span>
        </Link>

        <h1 className="truncate text-center text-base font-semibold tracking-wide text-slate-500 sm:text-sm uppercase sm:tracking-widest">
          Transparency Matters
        </h1>

        <div className="flex w-10 shrink-0 justify-end sm:w-40">
          <Link
            href={user ? "/profile" : "/login"}
            aria-label={user ? "Your profile" : "Sign in"}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white"
          >
            {initials ?? <User size={18} />}
          </Link>
        </div>
      </header>

      {/* Welcome */}
      <section className="-mx-4 border-b border-stone-200 bg-gradient-to-br from-teal-50 via-stone-50 to-blue-50 px-4 sm:-mx-6 sm:px-6">
        <div className="mx-auto max-w-3xl py-14 text-center sm:py-20">
          <h2 className="mb-5 text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl">
            Welcome to PublikEye
          </h2>
          <p className="mx-auto max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            We believe in <span className="font-semibold text-slate-800">open democracy</span> and{" "}
            <span className="font-semibold text-slate-800">accountability</span>. PublikEye tracks
            how state resources and public funds are used by members of parliament. All information
            here is{" "}
            <span className="font-semibold text-slate-800">publicly available</span> — we simply
            bring it together in one place.
          </p>
          {!loading && !user && (
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="rounded-lg bg-teal-600 px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
              >
                Create an account
              </Link>
              <Link
                href="/login"
                className="rounded-lg border border-stone-300 bg-white px-7 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-stone-50"
              >
                Sign in
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Category cards — authenticated only */}
      {user && (
        <section className="py-10 sm:py-14">
          <h3 className="mb-6 text-sm font-semibold uppercase tracking-widest text-slate-400">
            Explore
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <Link
                  key={cat.id}
                  href={cat.href}
                  className="group rounded-lg border border-stone-200 bg-white p-6 transition-all hover:border-teal-300 hover:shadow-sm"
                >
                  <div className="flex h-full flex-col gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 transition-colors group-hover:bg-teal-100">
                      <Icon className="text-teal-600" size={20} />
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900 transition-colors group-hover:text-teal-700">
                      {cat.title}
                    </h4>
                    <p className="text-xs leading-relaxed text-slate-500">{cat.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Footer — always visible */}
      <footer className="-mx-4 mt-4 bg-[#111008] px-4 sm:-mx-6 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 py-5">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-stone-100">PublikEye</span>
            <span className="font-serif text-xs italic text-stone-500">We simply make it findable.</span>
          </div>
          <nav className="flex gap-6">
            {["Terms", "About", "Data sources"].map((item) => (
              <Link key={item} href="#" className="text-xs text-stone-500 transition-colors hover:text-stone-300">
                {item}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
