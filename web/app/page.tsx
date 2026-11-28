"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Users, FileText, Search, AlertCircle, Loader2, UserCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@supabase/supabase-js";

const CHAMBER_LABEL: Record<string, string> = {
  na:    "National Assembly",
  ncop:  "NCOP",
  local: "Local Government",
};
const CHAMBER_COLOR: Record<string, string> = {
  na:    "bg-teal-50 text-teal-700",
  ncop:  "bg-blue-50 text-blue-700",
  local: "bg-amber-50 text-amber-700",
};

type MpResult = {
  id: string;
  full_name: string;
  known_as: string | null;
  party: string | null;
  constituency: string | null;
  chamber: string;
  portfolio: string | null;
};

function useGlobalSearch(query: string) {
  const [results, setResults] = useState<MpResult[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data } = await sb
        .from("v_mps_public")
        .select("id, full_name, known_as, party, constituency, chamber, portfolio")
        .or(`full_name.ilike.%${q}%,party.ilike.%${q}%,constituency.ilike.%${q}%,known_as.ilike.%${q}%`)
        .order("full_name")
        .limit(12);
      setResults((data as MpResult[]) ?? []);
      setLoading(false);
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  return { results, loading };
}

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
  const [search, setSearch] = useState("");
  const { results, loading: searching } = useGlobalSearch(search);
  const q = search.trim();

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

      {/* Global search */}
      <div className="mb-8">
        <div className="relative">
          {searching
            ? <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
            : <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          }
          <input
            type="search"
            placeholder="Search any MP, councillor, party, constituency…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-3 text-sm bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm"
          />
        </div>

        {q.length >= 2 && (
          <div className="mt-2 bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden">
            {results.length === 0 && !searching && (
              <div className="px-4 py-6 text-center text-sm text-slate-400">
                No members match &ldquo;{q}&rdquo;
              </div>
            )}
            {results.map((mp) => (
              <Link
                key={mp.id}
                href={`/mps/${mp.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 border-b border-stone-100 last:border-0 transition-colors group"
              >
                <UserCircle className="w-7 h-7 text-slate-300 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 group-hover:text-teal-700 truncate">
                    {mp.known_as ?? mp.full_name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {[mp.party, mp.constituency].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${CHAMBER_COLOR[mp.chamber] ?? "bg-slate-100 text-slate-600"}`}>
                  {CHAMBER_LABEL[mp.chamber] ?? mp.chamber}
                </span>
              </Link>
            ))}
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
