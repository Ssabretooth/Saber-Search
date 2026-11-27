import { getSupabase } from "@/lib/supabase";
import Link from "next/link";
import { ArrowUpRight, Scale, Info } from "lucide-react";

export const dynamic = "force-dynamic";

type ProcurementFlag = {
  id: string;
  public_text: string | null;
  mp_name: string | null;
  mp_party: string | null;
  tender_company: string | null;
  disclosure_counterparty: string | null;
  disclosure_category: string | null;
  tender_amount_zar: string | null;
  award_date: string | null;
  department: string | null;
  tender_title: string | null;
  match_reason: string | null;
  mp_id: string;
};

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtAmount(zar: string | null | number): string {
  if (!zar) return "—";
  const n = typeof zar === "string" ? parseFloat(zar) : zar;
  if (isNaN(n)) return "—";
  if (n >= 1e9) return `R${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `R${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `R${(n / 1e3).toFixed(0)}K`;
  return `R${n.toLocaleString("en-ZA")}`;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" });
}

/** Strip surrounding parens, normalise case for grouping */
function normaliseKey(s: string): string {
  return s.replace(/^\(|\)$/g, "").trim().toUpperCase();
}

const PARTY_CHIP: Record<string, { bg: string; text: string; dot: string }> = {
  ANC:   { bg: "bg-green-100",  text: "text-green-800",  dot: "bg-green-500"  },
  DA:    { bg: "bg-blue-100",   text: "text-blue-800",   dot: "bg-blue-500"   },
  EFF:   { bg: "bg-red-100",    text: "text-red-800",    dot: "bg-red-500"    },
  MK:    { bg: "bg-purple-100", text: "text-purple-800", dot: "bg-purple-500" },
  IFP:   { bg: "bg-orange-100", text: "text-orange-800", dot: "bg-orange-500" },
};

function partyAbbr(party: string | null): string {
  if (!party) return "";
  const u = party.toUpperCase();
  if (u.includes("ANC")) return "ANC";
  if (u.includes("DEMOCRATIC ALLIANCE") || u.startsWith("DA")) return "DA";
  if (u.includes("EFF")) return "EFF";
  if (u.includes("UMKHONTO") || /\bMK\b/.test(u)) return "MK";
  if (u.includes("IFP")) return "IFP";
  return "Other";
}

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

// ── page ─────────────────────────────────────────────────────────────────────

export default async function TendersPage() {
  const supabase = getSupabase();
  const { data: raw, error } = await supabase
    .from("v_procurement_flags_public")
    .select("*")
    .order("tender_amount_zar", { ascending: false }) as unknown as {
    data: ProcurementFlag[] | null;
    error: unknown;
  };
  if (error) throw new Error(`Procurement flags: ${(error as { message?: string }).message ?? String(error)}`);
  const flags = raw ?? [];

  // ── aggregate by normalised company name ───────────────────────────────────
  type CompanyGroup = {
    displayName: string;
    amount: number;
    awardDate: string | null;
    department: string | null;
    mps: { id: string; name: string; party: string | null; category: string | null }[];
    categories: Set<string>;
  };

  const groupMap = new Map<string, CompanyGroup>();
  for (const f of flags) {
    const key = normaliseKey(f.tender_company ?? "Unknown");
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        displayName: (f.tender_company ?? "Unknown").replace(/^\(|\)$/g, "").trim(),
        amount: parseFloat(f.tender_amount_zar ?? "0") || 0,
        awardDate: f.award_date,
        department: f.department,
        mps: [],
        categories: new Set(),
      });
    }
    const g = groupMap.get(key)!;
    if (f.mp_name && !g.mps.find((m) => m.id === f.mp_id)) {
      g.mps.push({ id: f.mp_id, name: f.mp_name, party: f.mp_party, category: f.disclosure_category });
    }
    if (f.disclosure_category) g.categories.add(f.disclosure_category);
    // keep largest amount per group
    const a = parseFloat(f.tender_amount_zar ?? "0") || 0;
    if (a > g.amount) {
      g.amount = a;
      g.awardDate = f.award_date;
      g.department = f.department;
    }
  }

  const companies = [...groupMap.values()].sort((a, b) => b.amount - a.amount);
  const maxAmount = companies[0]?.amount ?? 1;

  // ── top-level stats ────────────────────────────────────────────────────────
  const totalFlagged = flags.length;
  const uniqueMps = new Set(flags.filter((f) => f.mp_name).map((f) => f.mp_id)).size;
  const uniqueCompanies = companies.length;
  const totalValue = companies.reduce((s, c) => s + c.amount, 0);

  // party breakdown of named MPs
  const partyCounts: Record<string, number> = {};
  flags.forEach((f) => {
    if (!f.mp_name) return;
    const a = partyAbbr(f.mp_party);
    partyCounts[a] = (partyCounts[a] ?? 0) + 1;
  });
  const partyTotal = Object.values(partyCounts).reduce((s, v) => s + v, 0);

  return (
    <div className="min-h-screen bg-[#F4F2ED]">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <div className="bg-[#111827] text-white px-6 py-12 md:px-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <Scale size={16} className="text-amber-400" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">Accountability Intelligence</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none mb-3">
            Follow the<br />
            <span className="text-amber-400">Tender.</span>
          </h1>
          <p className="text-slate-400 text-sm max-w-xl leading-relaxed">
            Automated cross-reference of government tender awards against MPs' declared
            financial interests. A match signals a declared connection — not proof of
            wrongdoing, but a thread worth pulling.
          </p>

          {/* stat row */}
          <div className="mt-8 grid grid-cols-2 gap-px bg-white/10 rounded-xl overflow-hidden">
            {[
              { label: "Connections", value: totalFlagged.toString() },
              { label: "MPs involved", value: uniqueMps.toString() },
              { label: "Companies", value: uniqueCompanies.toString() },
              { label: "Total flagged value", value: fmtAmount(totalValue) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[#1a2235] px-5 py-5">
                <div className="text-2xl md:text-3xl font-black tabular-nums text-white">{value}</div>
                <div className="text-[11px] font-medium uppercase tracking-widest text-slate-500 mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── PARTY SPLIT ──────────────────────────────────────────────────── */}
      {partyTotal > 0 && (
        <div className="max-w-5xl mx-auto px-6 md:px-10 mt-6">
          <div className="bg-white rounded-xl border border-stone-200 px-5 py-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">Party breakdown of flagged MPs</p>
            <div className="flex h-3 rounded-full overflow-hidden gap-px">
              {Object.entries(partyCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([party, count]) => {
                  const chip = PARTY_CHIP[party] ?? { dot: "bg-slate-400" };
                  return (
                    <div
                      key={party}
                      className={`${chip.dot} transition-all`}
                      style={{ width: `${(count / partyTotal) * 100}%` }}
                      title={`${party}: ${count} connection${count !== 1 ? "s" : ""}`}
                    />
                  );
                })}
            </div>
            <div className="flex flex-wrap gap-4 mt-3">
              {Object.entries(partyCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([party, count]) => {
                  const chip = PARTY_CHIP[party] ?? { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-400" };
                  return (
                    <div key={party} className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${chip.dot}`} />
                      <span className="text-xs text-slate-600 font-medium">{party}</span>
                      <span className="text-xs text-slate-400">{count}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ── DISCLAIMER ───────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 md:px-10 mt-4">
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <Info size={14} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 leading-relaxed">
            <strong>Algorithmic matching.</strong> Flags are generated by name-normalisation + fuzzy match, not manual verification.
            A flag means an MP <em>declared</em> an interest in a company that received a government contract — MPs are
            legally required to make these declarations. Absence of a flag does not mean no conflict exists.
          </p>
        </div>
      </div>

      {/* ── COMPANY CARDS ────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 md:px-10 mt-6 pb-16 space-y-4">

        {companies.map((co, idx) => {
          const pct = maxAmount > 0 ? (co.amount / maxAmount) * 100 : 0;
          const rank = idx + 1;
          // heat colour based on amount tier
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
              key={co.displayName}
              className={`bg-white rounded-xl border border-stone-200 border-l-4 ${heatBorder} shadow-sm overflow-hidden`}
            >
              {/* card header */}
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

                {/* amount heat bar */}
                <div className="mt-3 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${heatBar} rounded-full transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-slate-300">0</span>
                  <span className="text-[10px] text-slate-400 font-medium">{pct.toFixed(0)}% of highest</span>
                </div>
              </div>

              {/* divider */}
              <div className="border-t border-stone-100 mx-4 md:mx-5" />

              {/* MPs + categories */}
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
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold
                            transition-opacity hover:opacity-75 ${chip.bg} ${chip.text}`}
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

                {/* category tags */}
                <div className="flex flex-wrap gap-1">
                  {[...co.categories].map((cat) => (
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
      </div>

      {/* footer */}
      <div className="max-w-5xl mx-auto px-6 md:px-10 pb-10 text-center">
        <p className="text-xs text-slate-400">
          Sources: Parliament Register of Members&rsquo; Interests &middot; National Treasury OCDS API &middot; Open Contracting Partnership
          &middot; Data coverage: 2023–2026 &middot; {flags.length} connections computed across 6 964 tender awards
        </p>
      </div>
    </div>
  );
}
