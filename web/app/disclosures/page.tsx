import Link from "next/link";
import { TrendingUp, Building2, Briefcase, Wallet, Gift, Plane, FileText, Users, DollarSign, LayoutGrid } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { DisclosuresClient } from "./DisclosuresClient";

export const dynamic = "force-dynamic";

// ── category metadata ────────────────────────────────────────────────────────

const CATEGORIES: Record<string, {
  label: string; Icon: typeof FileText;
  color: string; bg: string; border: string;
}> = {
  shareholding:     { label: "Shares & Investments", Icon: TrendingUp,  color: "text-indigo-700", bg: "bg-indigo-50",  border: "border-indigo-200"  },
  directorship:     { label: "Directorships",         Icon: Building2,   color: "text-blue-700",   bg: "bg-blue-50",    border: "border-blue-200"    },
  consultancy:      { label: "Consultancy",            Icon: Briefcase,   color: "text-cyan-700",   bg: "bg-cyan-50",    border: "border-cyan-200"    },
  paid_employment:  { label: "Employment",             Icon: Wallet,      color: "text-emerald-700",bg: "bg-emerald-50", border: "border-emerald-200" },
  gift_hospitality: { label: "Gifts & Hospitality",   Icon: Gift,        color: "text-amber-700",  bg: "bg-amber-50",   border: "border-amber-200"   },
  foreign_travel:   { label: "Foreign Travel",         Icon: Plane,       color: "text-sky-700",    bg: "bg-sky-50",     border: "border-sky-200"     },
  other:            { label: "Other Interests",        Icon: FileText,    color: "text-slate-600",  bg: "bg-slate-50",   border: "border-slate-200"   },
};

function categoryMeta(cat: string) {
  return CATEGORIES[cat] ?? CATEGORIES.other;
}

// ── party alliances ──────────────────────────────────────────────────────────

interface Alliance {
  key: string;
  label: string;
  abbr: string;
  accent: string;         // tailwind text colour for the banner
  bg: string;             // banner background
  border: string;
  match: (p: string | null) => boolean;
}

const ALLIANCES: Alliance[] = [
  {
    key: "anc", label: "African National Congress", abbr: "ANC",
    accent: "text-green-800", bg: "bg-green-50", border: "border-green-200",
    match: (p) => !!p && p.toUpperCase().includes("ANC"),
  },
  {
    key: "da", label: "Democratic Alliance", abbr: "DA",
    accent: "text-blue-800", bg: "bg-blue-50", border: "border-blue-200",
    match: (p) => !!p && (p.toUpperCase().includes(" DA") || p.toUpperCase().startsWith("DA") || p.toUpperCase().includes("DEMOCRATIC ALLIANCE")),
  },
  {
    key: "eff", label: "Economic Freedom Fighters", abbr: "EFF",
    accent: "text-red-800", bg: "bg-red-50", border: "border-red-200",
    match: (p) => !!p && p.toUpperCase().includes("EFF"),
  },
  {
    key: "mk", label: "uMkhonto we Sizwe Party", abbr: "MK",
    accent: "text-purple-800", bg: "bg-purple-50", border: "border-purple-200",
    match: (p) => !!p && (p.toUpperCase().includes("MK") || p.toUpperCase().includes("UMKHONTO")),
  },
  {
    key: "ifp", label: "Inkatha Freedom Party", abbr: "IFP",
    accent: "text-orange-800", bg: "bg-orange-50", border: "border-orange-200",
    match: (p) => !!p && p.toUpperCase().includes("IFP"),
  },
  {
    key: "other", label: "Other Parties", abbr: "Other",
    accent: "text-slate-700", bg: "bg-slate-50", border: "border-slate-200",
    match: (p) => {
      if (!p) return false;
      const u = p.toUpperCase();
      return !u.includes("ANC") && !u.includes(" DA") && !u.startsWith("DA")
        && !u.includes("DEMOCRATIC ALLIANCE") && !u.includes("EFF")
        && !u.includes("MK") && !u.includes("UMKHONTO") && !u.includes("IFP");
    },
  },
  {
    key: "unknown", label: "Unknown Alliance / Independent", abbr: "Unknown Alliance",
    accent: "text-zinc-600", bg: "bg-zinc-50", border: "border-zinc-200",
    match: (p) => !p,
  },
];

function allianceFor(party: string | null): Alliance {
  return ALLIANCES.find((a) => a.match(party)) ?? ALLIANCES[ALLIANCES.length - 1];
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

  let query = supabase
    .from("v_disclosures_public")
    .select("id, mp_id, category, description, counterparty, value_zar")
    .order("mp_id");

  if (catFilter && catFilter !== "all") {
    query = query.eq("category", catFilter);
  }

  const { data: disclosures, error } = await query.limit(2000);
  if (error) throw new Error(`Failed to load disclosures: ${error.message}`);

  const mpIds = [...new Set((disclosures ?? []).map((d) => d.mp_id))];
  const { data: mpsRaw, error: mpErr } = mpIds.length
    ? await supabase
        .from("v_mps_public")
        .select("id, full_name, known_as, party, chamber")
        .in("id", mpIds)
    : { data: [], error: null };
  if (mpErr) throw new Error(`Failed to load MP data: ${mpErr.message}`);

  const mpById = new Map<string, MP>((mpsRaw ?? []).map((m) => [m.id, m as MP]));

  // Build MP groups
  const groups = new Map<string, MPGroup>();
  for (const d of disclosures ?? []) {
    const mp = mpById.get(d.mp_id);
    if (!mp) continue;
    if (!groups.has(d.mp_id)) groups.set(d.mp_id, { mp, disclosures: [], totalValue: 0 });
    const g = groups.get(d.mp_id)!;
    g.disclosures.push(d as Disclosure);
    if (d.value_zar) g.totalValue += Number(d.value_zar);
  }

  const allGroups = [...groups.values()].sort((a, b) =>
    (a.mp.full_name ?? "").localeCompare(b.mp.full_name ?? "")
  );

  // Split by alliance — strip `match` fn before passing to client component (not serializable)
  const byAlliance = ALLIANCES.map(({ match: _match, ...alliance }) => ({
    alliance,
    groups: allGroups.filter((g) => allianceFor(g.mp.party).key === alliance.key),
  })).filter((s) => s.groups.length > 0);

  const totalDisclosures = (disclosures ?? []).length;
  const totalValue = allGroups.reduce((s, g) => s + g.totalValue, 0);
  const memberCount = allGroups.length;

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Hero ── */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 pt-7 pb-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-teal-600 mb-1.5">
            2026 Register of Members&apos; Interests
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mb-5">
            Financial Disclosures
          </h1>

          {/* Stats — 1 col on xs, 3 on sm+ */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-5">
            <StatTile Icon={LayoutGrid} label="Declarations" value={totalDisclosures.toLocaleString()} />
            <StatTile Icon={Users}      label="Members"      value={memberCount.toLocaleString()} />
            <StatTile
              Icon={DollarSign}
              label="Declared"
              value={`R${(totalValue / 1_000_000).toFixed(1)}M`}
            />
          </div>

          {/* Category filter — horizontal scroll on mobile */}
          <div className="-mx-4 px-4 overflow-x-auto">
            <div className="flex gap-2 pb-1 w-max sm:w-auto sm:flex-wrap">
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
      </div>

      {/* ── Feed grouped by party alliance (client-rendered with search) ── */}
      <DisclosuresClient byAlliance={byAlliance} />

      <div className="max-w-4xl mx-auto px-4 pb-10 text-[11px] text-slate-400 leading-relaxed">
        Source: Parliament Register of Members&apos; Interests, June 2026. Figures reproduced
        from official public records. Statistical observations are not findings of wrongdoing.
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatTile({ Icon, label, value }: { Icon: typeof FileText; label: string; value: string }) {
  return (
    <div className="bg-slate-50 border rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
      <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
        <Icon className="text-teal-600" size={14} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] sm:text-xs text-slate-500 font-medium leading-tight truncate">{label}</p>
        <p className="text-lg sm:text-xl font-bold text-slate-900 leading-tight tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function FilterPill({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
        active
          ? "bg-teal-600 text-white shadow-sm"
          : "bg-white border border-slate-200 text-slate-600 hover:border-teal-400 hover:text-teal-700"
      }`}
    >
      {label}
    </Link>
  );
}

