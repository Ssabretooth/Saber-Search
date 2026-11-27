import {
  TrendingUp, Building2, Briefcase, Wallet, Gift, Plane, FileText,
} from "lucide-react";
import { SourceCitation } from "@/components/SourceCitation";
import type { DisclosurePublic, SourceDocument } from "@/lib/types/database";

type Row = DisclosurePublic & { source?: SourceDocument };

// ── category metadata (mirrors disclosures feed) ─────────────────────────────

const CATEGORIES: Record<string, {
  label: string;
  Icon: typeof FileText;
  color: string;
  bg: string;
  border: string;
}> = {
  shareholding:     { label: "Shares & Investments", Icon: TrendingUp,  color: "text-indigo-700", bg: "bg-indigo-50",  border: "border-indigo-200"  },
  directorship:     { label: "Directorships",         Icon: Building2,   color: "text-blue-700",   bg: "bg-blue-50",    border: "border-blue-200"    },
  consultancy:      { label: "Consultancy",            Icon: Briefcase,   color: "text-cyan-700",   bg: "bg-cyan-50",    border: "border-cyan-200"    },
  paid_employment:  { label: "Employment",             Icon: Wallet,      color: "text-emerald-700",bg: "bg-emerald-50", border: "border-emerald-200" },
  gift_hospitality: { label: "Gifts & Hospitality",   Icon: Gift,        color: "text-amber-700",  bg: "bg-amber-50",   border: "border-amber-200"   },
  foreign_travel:   { label: "Foreign Travel",         Icon: Plane,       color: "text-sky-700",    bg: "bg-sky-50",     border: "border-sky-200"     },
  other:            { label: "Other Interests",        Icon: FileText,    color: "text-slate-600",  bg: "bg-slate-50",   border: "border-slate-200"   },
};

function catMeta(cat: string) {
  return CATEGORIES[cat] ?? CATEGORIES.other;
}

// ── component ────────────────────────────────────────────────────────────────

export function DisclosuresTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed bg-slate-50 p-5 text-sm text-slate-400 text-center">
        No financial disclosures on record for this member.
      </p>
    );
  }

  // Group by category
  const byCat = new Map<string, Row[]>();
  for (const r of rows) {
    if (!byCat.has(r.category)) byCat.set(r.category, []);
    byCat.get(r.category)!.push(r);
  }

  // Summary stats
  const totalValue = rows.reduce((s, r) => s + (r.value_zar ? Number(r.value_zar) : 0), 0);
  const valuedCount = rows.filter((r) => r.value_zar !== null).length;

  return (
    <div className="space-y-3">

      {/* Summary strip */}
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="font-semibold text-slate-700">
          {rows.length} declaration{rows.length !== 1 ? "s" : ""}
        </span>
        <span className="text-slate-300">·</span>
        <span className="text-slate-500">{byCat.size} categor{byCat.size !== 1 ? "ies" : "y"}</span>
        {totalValue > 0 && (
          <>
            <span className="text-slate-300">·</span>
            <span className="font-semibold text-emerald-700">
              R{totalValue.toLocaleString("en-ZA", { maximumFractionDigits: 0 })} declared
              {valuedCount < rows.length && (
                <span className="font-normal text-slate-400 ml-1">
                  ({valuedCount} of {rows.length} valued)
                </span>
              )}
            </span>
          </>
        )}
      </div>

      {/* Category sections */}
      {[...byCat.entries()].map(([cat, catRows]) => {
        const { label, Icon, color, bg, border } = catMeta(cat);
        const catTotal = catRows.reduce((s, r) => s + (r.value_zar ? Number(r.value_zar) : 0), 0);

        return (
          <div key={cat} className="rounded-xl border overflow-hidden">
            {/* Category header */}
            <div className={`flex items-center justify-between px-4 py-2.5 ${bg} border-b ${border}`}>
              <div className={`flex items-center gap-1.5 text-xs font-semibold ${color}`}>
                <Icon size={12} />
                {label}
              </div>
              <div className="flex items-center gap-3">
                {catTotal > 0 && (
                  <span className={`text-[11px] font-semibold tabular-nums ${color} opacity-80`}>
                    R{catTotal.toLocaleString("en-ZA", { maximumFractionDigits: 0 })}
                  </span>
                )}
                <span className="text-[11px] text-slate-400 font-medium">
                  {catRows.length}
                </span>
              </div>
            </div>

            {/* Rows */}
            <div className="bg-white divide-y divide-slate-100">
              {catRows.map((r) => (
                <div key={r.id} className="px-4 py-2.5 flex items-baseline gap-3">
                  {/* Primary content */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    {r.counterparty && (
                      <p className="text-sm font-medium text-slate-900 leading-snug">
                        {r.counterparty}
                      </p>
                    )}
                    {r.description && (
                      <p className={`text-xs text-slate-500 leading-snug ${!r.counterparty ? "font-medium text-slate-700 text-sm" : ""}`}>
                        {r.description}
                      </p>
                    )}
                    {!r.counterparty && !r.description && (
                      <p className="text-xs text-slate-300 italic">No detail provided</p>
                    )}
                  </div>

                  {/* Value + source */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {r.value_zar !== null ? (
                      <span className="text-xs font-semibold tabular-nums text-slate-800 whitespace-nowrap">
                        R{Number(r.value_zar).toLocaleString("en-ZA")}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-200">—</span>
                    )}
                    <SourceCitation source={r.source} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
