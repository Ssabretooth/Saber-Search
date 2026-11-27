import { getSupabase } from "@/lib/supabase";
import Link from "next/link";
import {
  ArrowUpRight, ShieldAlert, TrendingUp, Building2,
  Gift, Briefcase, Wallet, FileText, AlertTriangle,
  CheckCircle2, Clock, Database,
} from "lucide-react";

export const dynamic = "force-dynamic";

type FlagRow = {
  id: string;
  flag_type: string;
  public_text: string | null;
  rule_id: string | null;
  subject_id?: string;
  inputs?: {
    mp_name?: string;
    mp_party?: string;
    tender_company?: string;
    tender_amount_zar?: string;
    award_date?: string;
    department?: string;
    disclosure_category?: string;
  };
};

// ── helpers ──────────────────────────────────────────────────────────────────

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
  if (!party) return "";
  const u = party.toUpperCase();
  if (u.includes("ANC")) return "ANC";
  if (u.includes("DEMOCRATIC ALLIANCE") || u.startsWith("DA")) return "DA";
  if (u.includes("EFF")) return "EFF";
  if (/\bMK\b/.test(u) || u.includes("UMKHONTO")) return "MK";
  if (u.includes("IFP")) return "IFP";
  return "Other";
}

const PARTY_CHIP: Record<string, { bg: string; text: string; dot: string }> = {
  ANC:   { bg: "bg-green-100",  text: "text-green-800",  dot: "bg-green-500"  },
  DA:    { bg: "bg-blue-100",   text: "text-blue-800",   dot: "bg-blue-500"   },
  EFF:   { bg: "bg-red-100",    text: "text-red-800",    dot: "bg-red-500"    },
  MK:    { bg: "bg-purple-100", text: "text-purple-800", dot: "bg-purple-500" },
  IFP:   { bg: "bg-orange-100", text: "text-orange-800", dot: "bg-orange-500" },
  Other: { bg: "bg-slate-100",  text: "text-slate-700",  dot: "bg-slate-400"  },
};

const CAT_ICON: Record<string, typeof FileText> = {
  shareholding:     TrendingUp,
  directorship:     Building2,
  consultancy:      Briefcase,
  paid_employment:  Wallet,
  gift_hospitality: Gift,
};

const CAT_COLOR: Record<string, string> = {
  shareholding:     "text-indigo-600 bg-indigo-50 border-indigo-200",
  directorship:     "text-blue-600 bg-blue-50 border-blue-200",
  consultancy:      "text-cyan-600 bg-cyan-50 border-cyan-200",
  paid_employment:  "text-emerald-600 bg-emerald-50 border-emerald-200",
  gift_hospitality: "text-amber-600 bg-amber-50 border-amber-200",
  other:            "text-slate-500 bg-slate-50 border-slate-200",
};

const FLAG_TYPE_META: Record<string, {
  label: string;
  description: string;
  icon: typeof ShieldAlert;
  accent: string;
  bg: string;
  status: "active" | "planned";
}> = {
  procurement_relationship: {
    label: "Procurement Relationship",
    description: "MP's declared interest matches a government tender winner",
    icon: ShieldAlert,
    accent: "text-red-600",
    bg: "bg-red-50 border-red-200",
    status: "active",
  },
  asset_threshold: {
    label: "Asset Threshold",
    description: "Declared asset value crosses a materiality threshold",
    icon: TrendingUp,
    accent: "text-indigo-600",
    bg: "bg-indigo-50 border-indigo-200",
    status: "planned",
  },
  undisclosed_company: {
    label: "Undisclosed Company",
    description: "Company appears in CIPC records but not in MP's register",
    icon: Building2,
    accent: "text-orange-600",
    bg: "bg-orange-50 border-orange-200",
    status: "planned",
  },
  family_connection: {
    label: "Family Connection",
    description: "Surname overlap between MP and tender winner directors",
    icon: FileText,
    accent: "text-purple-600",
    bg: "bg-purple-50 border-purple-200",
    status: "planned",
  },
};

// ── page ─────────────────────────────────────────────────────────────────────

export default async function FlagsPage() {
  const supabase = getSupabase();

  // Fetch flags with full inputs JSON
  const { data: rawFlags, error } = await supabase
    .from("review_flags")
    .select("id, flag_type, public_text, rule_id, subject_id, inputs")
    .order("inputs->tender_amount_zar", { ascending: false })
    .limit(200) as unknown as { data: FlagRow[] | null; error: unknown };

  if (error) throw new Error(`Failed to load flags: ${(error as { message?: string }).message ?? String(error)}`);
  const flags = rawFlags ?? [];

  // Group by flag_type
  const byType: Record<string, FlagRow[]> = {};
  for (const f of flags) {
    (byType[f.flag_type] ??= []).push(f);
  }

  const totalFlags = flags.length;
  const activeTypes = Object.keys(byType).length;

  // Compute total value of procurement flags
  const procFlags = byType["procurement_relationship"] ?? [];
  const seenAmounts = new Map<string, number>();
  procFlags.forEach((f) => {
    const co = f.inputs?.tender_company ?? "";
    const amt = parseFloat(f.inputs?.tender_amount_zar ?? "0") || 0;
    if (!seenAmounts.has(co) || amt > (seenAmounts.get(co) ?? 0)) seenAmounts.set(co, amt);
  });
  const totalProcValue = [...seenAmounts.values()].reduce((s, v) => s + v, 0);

  // Sort procurement flags by amount desc, dedupe by (mp_id + company)
  const seen = new Set<string>();
  const deduped = procFlags.filter((f) => {
    const k = `${f.subject_id}|${f.inputs?.tender_company}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return (
    <div className="min-h-screen bg-[#F4F2ED]">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <div className="bg-[#111827] text-white px-6 py-12 md:px-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert size={14} className="text-red-400" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-red-400">Investigation Hub</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none mb-3">
            Alerts &<br />
            <span className="text-red-400">Flags.</span>
          </h1>
          <p className="text-slate-400 text-sm max-w-xl leading-relaxed">
            Automated signals generated by cross-referencing MP disclosures against government
            procurement data, company registries, and financial thresholds. Each flag is a
            starting point, not a verdict.
          </p>

          {/* stat row */}
          <div className="mt-8 grid grid-cols-2 gap-px bg-white/10 rounded-xl overflow-hidden">
            {[
              { label: "Total alerts", value: totalFlags.toString() },
              { label: "Active rule types", value: activeTypes.toString() },
              { label: "Rules in pipeline", value: Object.keys(FLAG_TYPE_META).length.toString() },
              { label: "Total flagged value", value: fmtAmount(totalProcValue.toString()) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[#1a2235] px-5 py-5">
                <div className="text-2xl md:text-3xl font-black tabular-nums text-white">{value}</div>
                <div className="text-[11px] font-medium uppercase tracking-widest text-slate-500 mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 md:px-10 py-8 space-y-8">

        {/* ── RULE TYPE CARDS ──────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Detection rules</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {Object.entries(FLAG_TYPE_META).map(([key, meta]) => {
              const Icon = meta.icon;
              const count = byType[key]?.length ?? 0;
              const isActive = meta.status === "active";
              return (
                <div
                  key={key}
                  className={`rounded-xl border px-5 py-4 flex items-start gap-4 ${
                    isActive
                      ? "bg-white border-stone-200 shadow-sm"
                      : "bg-stone-50 border-stone-200 opacity-60"
                  }`}
                >
                  <div className={`mt-0.5 p-2 rounded-lg border ${meta.bg}`}>
                    <Icon size={16} className={meta.accent} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-sm text-slate-900">{meta.label}</span>
                      {isActive ? (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                          <CheckCircle2 size={9} />Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-stone-100 border border-stone-200 rounded-full px-2 py-0.5">
                          <Clock size={9} />Planned
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{meta.description}</p>
                  </div>
                  {count > 0 && (
                    <div className="shrink-0 text-right">
                      <span className="text-2xl font-black tabular-nums text-slate-900">{count}</span>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">flags</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── PROCUREMENT FLAGS TABLE ───────────────────────────────────── */}
        {deduped.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
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

            {/* column headers */}
            <div className="hidden md:grid grid-cols-[1fr_1fr_auto_auto] gap-4 px-4 pb-2">
              {["Member of Parliament", "Company", "Value", "Interest"].map((h) => (
                <span key={h} className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{h}</span>
              ))}
            </div>

            <div className="space-y-1.5">
              {deduped
                .sort((a, b) =>
                  (parseFloat(b.inputs?.tender_amount_zar ?? "0") || 0) -
                  (parseFloat(a.inputs?.tender_amount_zar ?? "0") || 0)
                )
                .map((flag) => {
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
                        {abbr && (
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
                        {cat === "shareholding" ? "Shares"
                          : cat === "directorship" ? "Director"
                          : cat === "gift_hospitality" ? "Gift"
                          : cat === "paid_employment" ? "Employed"
                          : cat === "consultancy" ? "Consultant"
                          : cat}
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        )}

        {/* ── DATA PIPELINE STATUS ──────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Data pipeline</h2>
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm divide-y divide-stone-100">
            {[
              { label: "Parliament Register of Members' Interests", source: "pa.org.za", status: "live", detail: "Parsed via PDF ingestion" },
              { label: "National Treasury OCDS tender awards", source: "ocds-api.etenders.gov.za", status: "live", detail: "2023 – 2026, 6 964 awards" },
              { label: "Open Contracting Partnership bulk data", source: "data.open-contracting.org", status: "live", detail: "Annual JSONL.GZ archives" },
              { label: "CIPC company director bridge", source: "cipc.co.za", status: "planned", detail: "Links tender winner → directors" },
              { label: "OpenSanctions PEP / family graph", source: "opensanctions.org", status: "planned", detail: "Family & associate relationships" },
              { label: "Municipal awarded contract registers", source: "Various metros", status: "planned", detail: "MFMA quarterly registers" },
            ].map(({ label, source, status, detail }) => (
              <div key={label} className="flex items-center gap-4 px-5 py-3">
                <Database size={13} className={status === "live" ? "text-emerald-500" : "text-slate-300"} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{label}</p>
                  <p className="text-xs text-slate-400">{source} · {detail}</p>
                </div>
                <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide rounded-full px-2.5 py-1 ${
                  status === "live"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-stone-100 text-slate-500 border border-stone-200"
                }`}>
                  {status}
                </span>
              </div>
            ))}
          </div>
        </section>

        <p className="text-xs text-slate-400 text-center">
          Flags are auto-generated. All data sourced from public records. Last computed: {new Date().toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" })}.
        </p>
      </div>
    </div>
  );
}
