"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search, TrendingUp, Building2, Briefcase, Wallet, Gift, Plane,
  FileText, ChevronRight, Home,
} from "lucide-react";
import { PartyBadge } from "@/components/PartyBadge";

// ── types ─────────────────────────────────────────────────────────────────────

interface Disclosure {
  id: string;
  mp_id: string;
  category: string;
  description: string | null;
  counterparty: string | null;
  value_zar: number | null;
}
interface MP {
  id: string;
  full_name: string;
  known_as: string | null;
  party: string | null;
  chamber: string;
}
interface MPGroup {
  mp: MP;
  disclosures: Disclosure[];
  totalValue: number;
}
interface AllianceSection {
  alliance: {
    key: string;
    label: string;
    abbr: string;
    accent: string;
    bg: string;
    border: string;
  };
  groups: MPGroup[];
}

type Props = {
  byAlliance: AllianceSection[];
};

// ── category metadata ─────────────────────────────────────────────────────────

const CATEGORIES: Record<string, { label: string; Icon: typeof FileText; color: string; bg: string; border: string }> = {
  shareholding:     { label: "Shares & Investments", Icon: TrendingUp,  color: "text-indigo-700", bg: "bg-indigo-50",  border: "border-indigo-200"  },
  directorship:     { label: "Directorships",         Icon: Building2,   color: "text-blue-700",   bg: "bg-blue-50",    border: "border-blue-200"    },
  consultancy:      { label: "Consultancy",            Icon: Briefcase,   color: "text-cyan-700",   bg: "bg-cyan-50",    border: "border-cyan-200"    },
  paid_employment:  { label: "Employment",             Icon: Wallet,      color: "text-emerald-700",bg: "bg-emerald-50", border: "border-emerald-200" },
  gift_hospitality: { label: "Gifts & Hospitality",   Icon: Gift,        color: "text-amber-700",  bg: "bg-amber-50",   border: "border-amber-200"   },
  foreign_travel:   { label: "Foreign Travel",         Icon: Plane,       color: "text-sky-700",    bg: "bg-sky-50",     border: "border-sky-200"     },
  land_property:    { label: "Land & Property",        Icon: Home,        color: "text-stone-700",  bg: "bg-stone-50",   border: "border-stone-200"   },
  other:            { label: "Other Interests",        Icon: FileText,    color: "text-slate-600",  bg: "bg-slate-50",   border: "border-slate-200"   },
};

function categoryMeta(cat: string) {
  return CATEGORIES[cat] ?? CATEGORIES.other;
}

// ── component ─────────────────────────────────────────────────────────────────

export function DisclosuresClient({ byAlliance }: Props) {
  const [search, setSearch] = useState("");

  const q = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!q) return byAlliance;
    return byAlliance
      .map(({ alliance, groups }) => ({
        alliance,
        groups: groups
          .map(({ mp, disclosures, totalValue }) => {
            const name = (mp.known_as ?? mp.full_name).toLowerCase();
            const party = (mp.party ?? "").toLowerCase();
            // Keep the MP if name/party matches, or any disclosure counterparty/description/category matches
            const mpMatches = name.includes(q) || party.includes(q);
            const matchedDisclosures = mpMatches
              ? disclosures
              : disclosures.filter(
                  (d) =>
                    (d.counterparty ?? "").toLowerCase().includes(q) ||
                    (d.description ?? "").toLowerCase().includes(q) ||
                    d.category.toLowerCase().includes(q) ||
                    (categoryMeta(d.category).label).toLowerCase().includes(q),
                );
            if (matchedDisclosures.length === 0) return null;
            return { mp, disclosures: matchedDisclosures, totalValue };
          })
          .filter(Boolean) as MPGroup[],
      }))
      .filter((s) => s.groups.length > 0);
  }, [byAlliance, q]);

  const totalMps = filtered.reduce((s, s2) => s + s2.groups.length, 0);
  const totalDisclosures = filtered.reduce(
    (s, s2) => s + s2.groups.reduce((s3, g) => s3 + g.disclosures.length, 0),
    0,
  );

  return (
    <>
      {/* Search bar */}
      <div className="max-w-4xl mx-auto px-3 sm:px-4 pt-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            placeholder="Search MP name, party, company, description, interest type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm"
          />
        </div>
        {q && (
          <p className="text-xs text-slate-500 mt-2">
            {totalMps} member{totalMps !== 1 ? "s" : ""} · {totalDisclosures} disclosure{totalDisclosures !== 1 ? "s" : ""} match
          </p>
        )}
      </div>

      {/* Feed */}
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-8">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <Search className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No disclosures match your search.</p>
          </div>
        )}

        {filtered.map(({ alliance, groups: allianceGroups }) => (
          <details key={alliance.key} open className="group">
            <summary className={`flex items-center justify-between px-4 py-2.5 rounded-xl ${alliance.bg} border ${alliance.border} cursor-pointer list-none select-none`}>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] transition-transform group-open:rotate-90 mr-0.5 ${alliance.accent} opacity-50`}>▶</span>
                <span className={`text-xs font-black uppercase tracking-widest ${alliance.accent}`}>{alliance.abbr}</span>
                <span className={`hidden sm:inline text-xs font-semibold ${alliance.accent} opacity-70`}>
                  · {alliance.label}
                </span>
              </div>
              <span className={`text-xs font-semibold ${alliance.accent} opacity-60`}>
                {allianceGroups.length} member{allianceGroups.length !== 1 ? "s" : ""}
              </span>
            </summary>
            <div className="mt-3 space-y-3">
              {allianceGroups.map(({ mp, disclosures: rows, totalValue }) => (
                <MPCard key={mp.id} mp={mp} rows={rows} totalValue={totalValue} highlight={q} />
              ))}
            </div>
          </details>
        ))}
      </div>
    </>
  );
}

// ── MPCard ────────────────────────────────────────────────────────────────────

function MPCard({ mp, rows, totalValue, highlight }: { mp: MP; rows: Disclosure[]; totalValue: number; highlight: string }) {
  const displayName = mp.known_as ?? mp.full_name;
  const byCat = new Map<string, Disclosure[]>();
  for (const r of rows) {
    if (!byCat.has(r.category)) byCat.set(r.category, []);
    byCat.get(r.category)!.push(r);
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <Link
        href={`/mps/${mp.id}`}
        className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-slate-50/70 hover:bg-slate-100/70 transition-colors group"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-sm text-slate-900 group-hover:text-teal-700 transition-colors truncate">
            {displayName}
          </span>
          <PartyBadge party={mp.party} />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {totalValue > 0 && (
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full tabular-nums hidden sm:inline">
              R{totalValue.toLocaleString("en-ZA", { maximumFractionDigits: 0 })}
            </span>
          )}
          <span className="text-[11px] text-slate-400">{rows.length}</span>
          <ChevronRight size={13} className="text-slate-300 group-hover:text-teal-500 transition-colors" />
        </div>
      </Link>
      <div className="divide-y divide-slate-100">
        {[...byCat.entries()].map(([cat, catRows]) => {
          const { label, Icon, color, bg, border } = categoryMeta(cat);
          return (
            <div key={cat} className="px-4 py-2.5">
              <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${bg} ${color} border ${border} mb-1.5`}>
                <Icon size={10} />
                {label}
              </div>
              <div className="space-y-1">
                {catRows.map((r) => (
                  <div key={r.id} className="flex items-baseline justify-between gap-3 text-xs">
                    <div className="min-w-0 flex-1">
                      {r.counterparty && (
                        <span className="font-medium text-slate-800">{r.counterparty}</span>
                      )}
                      {r.counterparty && r.description && <span className="text-slate-400 mx-1">·</span>}
                      {r.description && <span className="text-slate-500">{r.description}</span>}
                      {!r.counterparty && !r.description && (
                        <span className="text-slate-300 italic">No detail provided</span>
                      )}
                    </div>
                    {r.value_zar !== null ? (
                      <span className="font-semibold tabular-nums text-slate-800 whitespace-nowrap flex-shrink-0">
                        R{Number(r.value_zar).toLocaleString("en-ZA")}
                      </span>
                    ) : (
                      <span className="text-slate-200 flex-shrink-0">—</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
