"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ArrowUpRight, FileText, TrendingUp, Building2, Gift, Briefcase, Wallet } from "lucide-react";

type FlagInputs = {
  mp_name?: string;
  mp_party?: string;
  tender_company?: string;
  tender_amount_zar?: string;
  award_date?: string;
  department?: string;
  disclosure_category?: string;
};

type FlagRow = {
  id: string;
  flag_type: string;
  public_text: string | null;
  rule_id: string | null;
  subject_id?: string;
  inputs?: FlagInputs;
};

type Props = {
  flags: FlagRow[];
};

const PARTY_CHIP: Record<string, { bg: string; text: string; dot: string }> = {
  ANC:   { bg: "bg-green-100",  text: "text-green-800",  dot: "bg-green-500"  },
  DA:    { bg: "bg-blue-100",   text: "text-blue-800",   dot: "bg-blue-500"   },
  EFF:   { bg: "bg-red-100",    text: "text-red-800",    dot: "bg-red-500"    },
  MK:    { bg: "bg-purple-100", text: "text-purple-800", dot: "bg-purple-500" },
  IFP:   { bg: "bg-orange-100", text: "text-orange-800", dot: "bg-orange-500" },
  Other: { bg: "bg-slate-100",  text: "text-slate-700",  dot: "bg-slate-400"  },
};

const CAT_ICON: Record<string, typeof FileText> = {
  shareholding:    TrendingUp,
  directorship:    Building2,
  consultancy:     Briefcase,
  paid_employment: Wallet,
  gift_hospitality:Gift,
};

const CAT_COLOR: Record<string, string> = {
  shareholding:     "text-indigo-600 bg-indigo-50 border-indigo-200",
  directorship:     "text-blue-600 bg-blue-50 border-blue-200",
  consultancy:      "text-cyan-600 bg-cyan-50 border-cyan-200",
  paid_employment:  "text-emerald-600 bg-emerald-50 border-emerald-200",
  gift_hospitality: "text-amber-600 bg-amber-50 border-amber-200",
  other:            "text-slate-500 bg-slate-50 border-slate-200",
};

const CAT_LABEL: Record<string, string> = {
  shareholding:     "Shares",
  directorship:     "Director",
  consultancy:      "Consultant",
  paid_employment:  "Employed",
  gift_hospitality: "Gift",
};

function fmtAmount(zar: string | null | undefined): string {
  if (!zar) return "—";
  const n = parseFloat(zar);
  if (isNaN(n)) return "—";
  if (n >= 1e9) return `R${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `R${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `R${(n / 1e3).toFixed(0)}K`;
  return `R${n.toLocaleString("en-ZA")}`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-ZA", { year: "numeric", month: "short" });
}

function partyAbbr(party: string | null | undefined): string {
  if (!party) return "Other";
  const u = party.toUpperCase();
  if (u.includes("ANC")) return "ANC";
  if (u.includes("DEMOCRATIC ALLIANCE") || u.startsWith("DA")) return "DA";
  if (u.includes("EFF")) return "EFF";
  if (/\bMK\b/.test(u) || u.includes("UMKHONTO")) return "MK";
  if (u.includes("IFP")) return "IFP";
  return "Other";
}

export function FlagsClient({ flags }: Props) {
  const [search, setSearch] = useState("");

  // Dedupe by (subject_id + company) — same logic as server
  const deduped = useMemo(() => {
    const seen = new Set<string>();
    return flags
      .filter((f) => f.flag_type === "procurement_relationship")
      .filter((f) => {
        const k = `${f.subject_id}|${f.inputs?.tender_company}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort(
        (a, b) =>
          (parseFloat(b.inputs?.tender_amount_zar ?? "0") || 0) -
          (parseFloat(a.inputs?.tender_amount_zar ?? "0") || 0),
      );
  }, [flags]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return deduped;
    return deduped.filter((f) => {
      const i = f.inputs ?? {};
      const abbr = partyAbbr(i.mp_party);
      const cat = i.disclosure_category ?? "";
      return (
        (i.mp_name ?? "").toLowerCase().includes(q) ||
        (i.mp_party ?? "").toLowerCase().includes(q) ||
        abbr.toLowerCase().includes(q) ||
        (i.tender_company ?? "").toLowerCase().includes(q) ||
        (i.department ?? "").toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q) ||
        (CAT_LABEL[cat] ?? "").toLowerCase().includes(q) ||
        (f.public_text ?? "").toLowerCase().includes(q)
      );
    });
  }, [deduped, search]);

  if (deduped.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">
          Procurement connections — {deduped.length} unique MP × company pairs
        </h2>
        <Link
          href="/tenders"
          className="text-xs font-semibold text-teal-600 hover:text-teal-800 flex items-center gap-1"
        >
          Full analysis <ArrowUpRight size={11} />
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="search"
          placeholder="Search MP, company, party, department, interest type…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 shadow-sm"
        />
      </div>
      {search && (
        <p className="text-xs text-slate-500 mb-3">
          {filtered.length} of {deduped.length} flags match
        </p>
      )}

      {/* Column headers */}
      <div className="hidden md:grid grid-cols-[1fr_1fr_auto_auto] gap-4 px-4 pb-2">
        {["Member of Parliament", "Company", "Value", "Interest"].map((h) => (
          <span key={h} className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{h}</span>
        ))}
      </div>

      <div className="space-y-1.5">
        {filtered.map((flag) => {
          const abbr = partyAbbr(flag.inputs?.mp_party);
          const chip = PARTY_CHIP[abbr] ?? PARTY_CHIP.Other;
          const cat = flag.inputs?.disclosure_category ?? "other";
          const CatIcon = CAT_ICON[cat] ?? FileText;
          const catStyle = CAT_COLOR[cat] ?? CAT_COLOR.other;
          const amount = parseFloat(flag.inputs?.tender_amount_zar ?? "0") || 0;
          const heatDot = amount >= 1e9 ? "bg-red-500"
            : amount >= 5e8 ? "bg-orange-400"
            : amount >= 1e8 ? "bg-amber-400"
            : "bg-teal-400";

          return (
            <div
              key={flag.id}
              className="bg-white rounded-xl border border-stone-200 shadow-sm flex flex-col md:grid md:grid-cols-[1fr_1fr_auto_auto] gap-2 md:gap-4 md:items-center px-4 py-3"
            >
              {/* MP */}
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${heatDot}`} />
                {flag.inputs?.mp_name ? (
                  <Link
                    href={`/mps/${flag.subject_id}`}
                    className="text-sm font-semibold text-slate-900 hover:text-teal-700 truncate flex items-center gap-1"
                  >
                    {flag.inputs.mp_name.replace(/^.*?,\s*/, "")}
                    <ArrowUpRight size={10} className="opacity-40 shrink-0" />
                  </Link>
                ) : (
                  <span className="text-sm text-slate-400 italic">Unmatched</span>
                )}
                {abbr && abbr !== "Other" && (
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${chip.bg} ${chip.text}`}>
                    {abbr}
                  </span>
                )}
              </div>

              {/* Company */}
              <div className="text-sm text-slate-700 font-medium truncate">
                {(flag.inputs?.tender_company ?? "—").replace(/^\(|\)$/g, "")}
                {flag.inputs?.department && (
                  <span className="block text-[11px] text-slate-400 font-normal">{flag.inputs.department}</span>
                )}
              </div>

              {/* Amount */}
              <div className="text-sm font-black tabular-nums text-slate-900 text-right whitespace-nowrap">
                {fmtAmount(flag.inputs?.tender_amount_zar)}
                {flag.inputs?.award_date && (
                  <span className="block text-[11px] text-slate-400 font-normal">{fmtDate(flag.inputs.award_date)}</span>
                )}
              </div>

              {/* Category */}
              <div className={`self-start flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold ${catStyle} whitespace-nowrap`}>
                <CatIcon size={11} />
                {CAT_LABEL[cat] ?? cat}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-10 text-slate-400">
            <Search className="w-6 h-6 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No flags match your search.</p>
          </div>
        )}
      </div>
    </section>
  );
}
