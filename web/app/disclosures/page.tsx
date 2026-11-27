import Link from "next/link";
import {
  TrendingUp, Building2, Briefcase, Wallet, Gift, Plane,
  FileText, Users, DollarSign, LayoutGrid,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { PartyBadge } from "@/components/PartyBadge";

export const dynamic = "force-dynamic";

// ── category metadata ────────────────────────────────────────────────────────

const CATEGORIES: Record<string, { label: string; Icon: typeof FileText; color: string; bg: string; border: string }> = {
  shareholding:    { label: "Shares & Investments", Icon: TrendingUp,  color: "text-indigo-700", bg: "bg-indigo-50",  border: "border-indigo-200" },
  directorship:   { label: "Directorships",         Icon: Building2,   color: "text-blue-700",   bg: "bg-blue-50",    border: "border-blue-200"   },
  consultancy:    { label: "Consultancy",            Icon: Briefcase,   color: "text-cyan-700",   bg: "bg-cyan-50",    border: "border-cyan-200"   },
  paid_employment:{ label: "Employment",             Icon: Wallet,      color: "text-emerald-700",bg: "bg-emerald-50", border: "border-emerald-200"},
  gift_hospitality:{ label: "Gifts & Hospitality",  Icon: Gift,        color: "text-amber-700",  bg: "bg-amber-50",   border: "border-amber-200"  },
  foreign_travel: { label: "Foreign Travel",         Icon: Plane,       color: "text-sky-700",    bg: "bg-sky-50",     border: "border-sky-200"    },
  other:          { label: "Other Interests",        Icon: FileText,    color: "text-slate-600",  bg: "bg-slate-50",   border: "border-slate-200"  },
};

function categoryMeta(cat: string) {
  return CATEGORIES[cat] ?? CATEGORIES.other;
}

// ── types ────────────────────────────────────────────────────────────────────

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

// ── page ─────────────────────────────────────────────────────────────────────

export default async function DisclosuresPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: catFilter } = await searchParams;
  const supabase = getSupabase();

  // 1. Load disclosures (all, or filtered by category)
  let query = supabase
    .from("v_disclosures_public")
    .select("id, mp_id, category, description, counterparty, value_zar")
    .order("mp_id");

  if (catFilter && catFilter !== "all") {
    query = query.eq("category", catFilter);
  }

  const { data: disclosures, error } = await query.limit(2000);
  if (error) throw new Error(`Failed to load disclosures: ${error.message}`);

  // 2. Load the MPs referenced by those disclosures
  const mpIds = [...new Set((disclosures ?? []).map((d) => d.mp_id))];
  const { data: mpsRaw, error: mpErr } = mpIds.length
    ? await supabase
        .from("v_mps_public")
        .select("id, full_name, known_as, party, chamber")
        .in("id", mpIds)
    : { data: [], error: null };
  if (mpErr) throw new Error(`Failed to load MP data: ${mpErr.message}`);

  const mpById = new Map<string, MP>((mpsRaw ?? []).map((m) => [m.id, m as MP]));

  // 3. Group disclosures by MP
  const groups = new Map<string, MPGroup>();
  for (const d of disclosures ?? []) {
    const mp = mpById.get(d.mp_id);
    if (!mp) continue;
    if (!groups.has(d.mp_id)) {
      groups.set(d.mp_id, { mp, disclosures: [], totalValue: 0 });
    }
    const g = groups.get(d.mp_id)!;
    g.disclosures.push(d as Disclosure);
    if (d.value_zar) g.totalValue += Number(d.value_zar);
  }

  const sortedGroups = [...groups.values()].sort((a, b) =>
    (a.mp.full_name ?? "").localeCompare(b.mp.full_name ?? "")
  );

  // 4. Summary stats
  const totalDisclosures = (disclosures ?? []).length;
  const totalValue = sortedGroups.reduce((s, g) => s + g.totalValue, 0);
  const memberCount = sortedGroups.length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Hero header ── */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-600 mb-2">
            2026 Register of Members' Interests
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-4">
            Financial Disclosures
          </h1>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <StatTile Icon={LayoutGrid} label="Declarations" value={totalDisclosures.toLocaleString()} />
            <StatTile Icon={Users} label="Members" value={memberCount.toLocaleString()} />
            <StatTile
              Icon={DollarSign}
              label="Declared Value"
              value={`R${(totalValue / 1_000_000).toFixed(1)}M`}
            />
          </div>

          {/* Category filter strip */}
          <div className="flex flex-wrap gap-2 mt-6">
            <FilterPill label="All" href="/disclosures" active={!catFilter || catFilter === "all"} />
            {Object.entries(CATEGORIES).map(([key, meta]) => (
              <FilterPill
                key={key}
                label={meta.label}
                href={`/disclosures?category=${key}`}
                active={catFilter === key}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Disclosure feed ── */}
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {sortedGroups.length === 0 && (
          <p className="text-center text-slate-500 py-16">No disclosures found.</p>
        )}
        {sortedGroups.map(({ mp, disclosures: rows, totalValue: mpTotal }) => (
          <MPCard key={mp.id} mp={mp} rows={rows} totalValue={mpTotal} />
        ))}
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-12 text-xs text-slate-400">
        Source: Parliament Register of Members&apos; Interests, June 2026. Figures reproduced from
        official public records. Statistical observations are not findings of wrongdoing.
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatTile({ Icon, label, value }: { Icon: typeof FileText; label: string; value: string }) {
  return (
    <div className="bg-slate-50 border rounded-xl p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
        <Icon className="text-teal-600" size={16} />
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-slate-900 leading-tight">{value}</p>
      </div>
    </div>
  );
}

function FilterPill({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
        active
          ? "bg-teal-600 text-white shadow-sm"
          : "bg-white border text-slate-600 hover:border-teal-400 hover:text-teal-700"
      }`}
    >
      {label}
    </Link>
  );
}

function MPCard({ mp, rows, totalValue }: { mp: MP; rows: Disclosure[]; totalValue: number }) {
  const displayName = mp.known_as ?? mp.full_name;
  // Group rows by category within this MP
  const byCat = new Map<string, Disclosure[]>();
  for (const r of rows) {
    if (!byCat.has(r.category)) byCat.set(r.category, []);
    byCat.get(r.category)!.push(r);
  }

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      {/* MP header */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b bg-slate-50/60">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/mps/${mp.id}`}
            className="font-bold text-slate-900 hover:text-teal-700 transition-colors truncate"
          >
            {displayName}
          </Link>
          <PartyBadge party={mp.party} />
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 text-right">
          {totalValue > 0 && (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              R{totalValue.toLocaleString("en-ZA", { maximumFractionDigits: 0 })}
            </span>
          )}
          <span className="text-xs text-slate-400">{rows.length} declaration{rows.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Category sections */}
      <div className="divide-y">
        {[...byCat.entries()].map(([cat, catRows]) => {
          const { label, Icon, color, bg, border } = categoryMeta(cat);
          return (
            <div key={cat} className="px-5 py-3">
              {/* Category label */}
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${bg} ${color} border ${border} mb-2`}>
                <Icon size={11} />
                {label}
              </div>

              {/* Rows */}
              <div className="space-y-1.5">
                {catRows.map((r) => (
                  <div key={r.id} className="grid grid-cols-[1fr_auto] gap-x-4 items-baseline text-sm">
                    <div className="min-w-0">
                      {r.counterparty && (
                        <span className="font-medium text-slate-800 mr-2">{r.counterparty}</span>
                      )}
                      {r.description && (
                        <span className="text-slate-500 text-xs">{r.description}</span>
                      )}
                      {!r.counterparty && !r.description && (
                        <span className="text-slate-400 italic text-xs">No detail provided</span>
                      )}
                    </div>
                    {r.value_zar !== null ? (
                      <span className="font-semibold tabular-nums text-slate-900 text-xs whitespace-nowrap">
                        R{Number(r.value_zar).toLocaleString("en-ZA")}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer link */}
      <div className="px-5 py-3 border-t bg-slate-50/40">
        <Link
          href={`/mps/${mp.id}`}
          className="text-xs text-teal-600 hover:underline font-medium"
        >
          View full profile →
        </Link>
      </div>
    </div>
  );
}
