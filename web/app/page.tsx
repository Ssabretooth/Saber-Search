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
    href: "/members",
  },
];


export default function HomePage() {
  const { user, profile, loading } = useAuth();
  const initials = profile?.first_name && profile?.last_name
    ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
    : user?.email?.[0]?.toUpperCase();

  return (
    <div>
      <header className="flex items-center justify-between gap-2 border-b pb-4">
        <Link href="/" className="flex w-10 shrink-0 items-center gap-2 sm:w-40">
          <Image src="/logo.jpg" alt="PublikEye" width={40} height={40} className="rounded-lg" />
          <span className="hidden text-sm font-semibold text-slate-900 sm:inline">PublikEye</span>
        </Link>

        <h1 className="truncate text-center text-lg font-bold text-slate-900 sm:text-2xl">
          Transparency Matters
        </h1>

        <div className="flex w-10 shrink-0 justify-end sm:w-40">
          <Link
            href={user ? "/profile" : "/login"}
            aria-label={user ? "Your profile" : "Sign in"}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-blue-600 text-sm font-bold text-white"
          >
            {initials ?? <User size={20} />}
          </Link>
        </div>
      </header>

      {/* Welcome Section */}
      <section className="-mx-4 border-b bg-gradient-to-r from-teal-50 to-blue-50 px-4 sm:-mx-6 sm:px-6">
        <div className="mx-auto max-w-4xl py-10 text-center sm:py-12">
          <h2 className="mb-4 text-2xl font-bold text-slate-900 sm:text-3xl">
            Welcome to PublikEye
          </h2>
          <p className="mx-auto max-w-2xl leading-relaxed text-slate-700 sm:text-lg">
            We believe in <span className="font-semibold">open democracy</span> and <span className="font-semibold">accountability</span>.
            PublikEye tracks how state resources and public funds are used by members of parliament.
            All information here is <span className="font-semibold">publicly available</span>—we simply bring it together in one place,
            respecting privacy while promoting transparency.
            Explore, learn, and stay informed about how your government works.
          </p>
          {!loading && !user && (
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/login" className="rounded-lg bg-teal-600 px-6 py-2.5 font-medium text-white hover:bg-teal-700">
                Sign in
              </Link>
              <Link href="/signup" className="rounded-lg border bg-white px-6 py-2.5 font-medium text-slate-900 hover:bg-slate-50">
                Create an account
              </Link>
            </div>
          )}
        </div>
      </section>

      {user && (
      <>
      {/* Categories Grid */}
      <section className="py-10 sm:py-14">
        <h3 className="mb-6 text-xl font-semibold text-slate-900">Explore Data</h3>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <Link
                key={cat.id}
                href={cat.href}
                className="group p-6 bg-white border rounded-lg hover:border-teal-400 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex flex-col gap-3 h-full">
                  <div className="w-12 h-12 bg-teal-50 rounded-lg flex items-center justify-center group-hover:bg-teal-100 transition-colors">
                    <Icon className="text-teal-600" size={24} />
                  </div>
                  <h4 className="font-semibold text-sm text-slate-900 group-hover:text-teal-600 transition-colors">
                    {cat.title}
                  </h4>
                  <p className="text-xs text-slate-600">{cat.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="-mx-4 mt-8 border-t bg-slate-50 px-4 sm:-mx-6 sm:px-6">
        <div className="py-8 text-center text-sm text-slate-600">
          <p>PublikEye — Transparency for accountable governance</p>
        </div>
      </footer>
      </>
      )}
    </div>
  );
}
