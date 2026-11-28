"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ArrowUpRight } from "lucide-react";

type CompanyGroup = {
  displayName: string;
  amount: number;
  awardDate: string | null;
  department: string | null;
  mps: { id: string; name: string; party: string | null; category: string | null }[];
  categories: string[];
};

type Props = {
  companies: CompanyGroup[];
  maxAmount: number;
};

const PARTY_CHIP: Record<string, { bg: string; text: string; dot: string }> = {
  ANC:   { bg: "bg-green-100",  text: "text-green-800",  dot: "bg-green-500"  },
  DA:    { bg: "bg-blue-100",   text: "text-blue-800",   dot: "bg-blue-500"   },
  EFF:   { bg: "bg-red-100",    text: "text-red-800",    dot: "bg-red-500"    },
  MK:    { bg: "bg-purple-100", text: "text-purple-800", dot: "bg-purple-500" },
  IFP:   { bg: "bg-orange-100", text: "text-orange-800", dot: "bg-orange-500" },
};

const CAT_LABEL: Record<string, string> = {
  shareholding:     "Shares",
  directorship:     "Director",
  consultancy:      "Consultant",
  paid_employment:  "Employed",
  gift_hospitality: "Gift / Hospitality",
  other:            "Other",
};

const CAT_COLOR: Record<string, string> = {
  shareholding:     "bg-indigo-100 text-indigo-700",
  directorship:     "bg-blue-100 text-blue-700",
  consultancy:      "bg-cyan-100 text-cyan-700",
  paid_employment:  "bg-emerald-100 text-emerald-700",
  gift_hospitality: "bg-amber-100 text-amber-700",
  other:            "bg-slate-100 text-slate-600",
};

function fmtAmount(n: number): string {
  if (!n) return "—";
  if (n >= 1e9) return `R${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `R${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `R${(n / 1e3).toFixed(0)}K`;
  return `R${n.toLocaleString("en-ZA")}`;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" });
}

function partyAbbr(party: string | null | undefined): string {
  if (!party) return "Other";
  const u = party.toUpperCase();
  if (u.includes("ANC")) return "ANC";
  if (u.includes("DEMOCRATIC ALLIANCE") || u.startsWith("DA")) return "DA";
  if (u.includes("EFF")) return "EFF";
  if (u.includes("UMKHONTO") || /\bMK\b/.test(u)) return "MK";
  if (u.includes("IFP")) return "IFP";
  return "Other";
}

export function TendersClient({ companies, maxAmount }: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((co) => {
      return (
        co.displayName.toLowerCase().includes(q) ||
        (co.department ?? "").toLowerCase().includes(q) ||
        co.mps.some((mp) =>
          (mp.name ?? "").toLowerCase().includes(q) ||
          (mp.party ?? "").toLowerCase().includes(q) ||
          partyAbbr(mp.party).toLowerCase().includes(q) ||
          (mp.category ?? "").toLowerCase().includes(q) ||
          (CAT_LABEL[mp.category ?? ""] ?? "").toLowerCase().includes(q)
        ) ||
        co.categories.some((cat) =>
          cat.toLowerCase().includes(q) ||
          (CAT_LABEL[cat] ?? "").toLowerCase().includes(q)
        )
      );
    });
  }, [companies, search]);

  return (
    <div className="max-w-5xl mx-auto px-6 md:px-10 mt-6 pb-16 space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="search"
          placeholder="Search company, MP name, party, department, interest type…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-sm"
        />
      </div>
      {search && (
        <p className="text-xs text-slate-500">
          {filtered.length} of {companies.length} companies match
        </p>
      )}

      {filtered.map((co, idx) => {
        const pct = maxAmount > 0 ? (co.amount / maxAmount) * 100 : 0;
        const rank = companies.indexOf(co) + 1;
        const heatBorder = co.amount >= 1e9 ? "border-l-red-600"
          : co.amount >= 5e8 ? "border-l-orange-500"
          : co.amount >= 1e8 ? "border-l-amber-500"
          : "border-l-teal-500";
        const heatBar = co.amount >= 1e9 ? "bg-red-500"
          : co.amount >= 5e8 ? "bg-orange-400"
          : co.amount >= 1e8 ? "bg-amber-400"
          : "bg-teal-400";

        return (
          <div
            key={co.displayName + idx}
            className={`bg-white rounded-xl border border-stone-200 border-l-4 ${heatBorder} shadow-sm overflow-hidden`}
          >
            <div className="px-4 md:px-5 pt-4 md:pt-5 pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-[10px] font-black text-slate-300 tabular-nums shrink-0">#{rank.toString().padStart(2, "0")}</span>
                    <h2 className="text-base md:text-lg font-black text-slate-900 leading-tight tracking-tight">
                      {co.displayName}
                    </h2>
                  </div>
                  {co.department && (
                    <p className="text-xs text-slate-400 line-clamp-1">{co.department}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xl md:text-2xl font-black tabular-nums text-slate-900 leading-none">
                    {fmtAmount(co.amount)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{fmtDate(co.awardDate)}</div>
                </div>
              </div>
              <div className="mt-3 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                <div className={`h-full ${heatBar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-slate-300">0</span>
                <span className="text-[10px] text-slate-400 font-medium">{pct.toFixed(0)}% of highest</span>
              </div>
            </div>

            <div className="border-t border-stone-100 mx-4 md:mx-5" />

            <div className="px-4 md:px-5 py-3 flex flex-col gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
                  {co.mps.length} MP{co.mps.length !== 1 ? "s" : ""} with declared interests
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {co.mps.map((mp) => {
                    const abbr = partyAbbr(mp.party);
                    const chip = PARTY_CHIP[abbr] ?? { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-400" };
                    return (
                      <Link
                        key={mp.id}
                        href={`/mps/${mp.id}`}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-opacity hover:opacity-75 ${chip.bg} ${chip.text}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${chip.dot} shrink-0`} />
                        {mp.name.replace(/^.*?,\s*/, "")}
                        <span className="opacity-60">{abbr}</span>
                        <ArrowUpRight size={9} className="opacity-40" />
                      </Link>
                    );
                  })}
                  {co.mps.length === 0 && (
                    <span className="text-xs text-slate-400 italic">Unmatched register entries only</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {co.categories.map((cat) => (
                  <span
                    key={cat}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${CAT_COLOR[cat] ?? "bg-slate-100 text-slate-600"}`}
                  >
                    {CAT_LABEL[cat] ?? cat}
                  </span>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Search className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No companies match your search.</p>
        </div>
      )}
    </div>
  );
}
