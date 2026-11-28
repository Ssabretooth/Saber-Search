import { notFound } from "next/navigation";
import { ExternalLink, MapPin, Building2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { SourceCitation } from "@/components/SourceCitation";
import { DisclosuresTable } from "@/components/DisclosuresTable";
import type {
  DisclosurePublic,
  FlagPublic,
  MpPublic,
  SourceDocument,
} from "@/lib/types/database";
import type { FlagType } from "@/lib/types/flags";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type WithSource<T> = T & { source?: SourceDocument };

export default async function MPProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase();
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const { data: mp, error: mpError } = await supabase
    .from("v_mps_public")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (mpError) throw new Error(`Failed to load MP ${id}: ${mpError.message}`);
  if (!mp) notFound();

  const mpProfile = mp as MpPublic;

  // For local councillors, fetch enriched ward/municipality data
  const localRes = mpProfile.chamber === "local"
    ? await supabase
        .from("v_local_councillors")
        .select("ward_no, muni_code, municipality_name, province")
        .eq("id", id)
        .maybeSingle()
    : null;
  const localData = localRes?.data as {
    ward_no: number | null;
    muni_code: string | null;
    municipality_name: string | null;
    province: string | null;
  } | null;

  const [flagsRes, disclosuresRes] = await Promise.all([
    supabase.from("v_flags_public").select("*").eq("subject_id", id),
    supabase
      .from("v_disclosures_public")
      .select("*")
      .eq("mp_id", id)
      .order("extracted_at", { ascending: false }),
  ]);

  for (const res of [flagsRes, disclosuresRes]) {
    if (res.error) throw new Error(`Failed to load records for MP ${id}: ${res.error.message}`);
  }
  const flags: FlagPublic[] = flagsRes.data ?? [];
  const procurementFlags = flags.filter((f) => f.flag_type === "procurement_relationship");
  const otherFlags = flags.filter((f) => f.flag_type !== "procurement_relationship");
  const disclosures: DisclosurePublic[] = disclosuresRes.data ?? [];

  const sourceIds = [
    ...new Set([...flags, ...disclosures].map((r) => r.source_document_id)),
  ];
  const { data: sources, error: sourcesError } = sourceIds.length
    ? await supabase
        .from("v_sources_public")
        .select("id, publisher, title, url, published_at, licence_note")
        .in("id", sourceIds)
    : { data: [], error: null };
  if (sourcesError) throw new Error(`Failed to load sources for MP ${id}: ${sourcesError.message}`);
  const sourceById = new Map<string, SourceDocument>((sources ?? []).map((s) => [s.id, s]));

  const withSource = <T extends { source_document_id: string }>(rows: T[]): WithSource<T>[] =>
    rows.map((r) => ({ ...r, source: sourceById.get(r.source_document_id) }));

  const profile: MpPublic = mpProfile;

  const accent = partyAccent(profile.party);
  const chamberLabel = CHAMBER_LABEL[profile.chamber] ?? profile.chamber.toUpperCase();
  const totalDeclared = disclosures.reduce((s, d) => s + (d.value_zar ? Number(d.value_zar) : 0), 0);

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="-mx-4 sm:-mx-8 -mt-6 mb-8 relative overflow-hidden bg-slate-900">
        {/* party colour bar */}
        <div className="absolute inset-y-0 left-0 w-[3px]" style={{ background: accent }} />

        <div className="max-w-5xl mx-auto pl-8 pr-6 pt-7 pb-8">
          {/* party + chamber row */}
          <div className="flex items-center justify-between mb-3">
            <span
              className="text-[11px] font-black uppercase tracking-widest"
              style={{ color: accent }}
            >
              {profile.party ?? "Independent"}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              {chamberLabel}
            </span>
          </div>

          {/* name */}
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-tight mb-1">
            {profile.full_name}
          </h1>
          {profile.known_as && profile.known_as !== profile.full_name && (
            <p className="text-slate-400 text-sm mb-4">
              Known as &ldquo;{profile.known_as}&rdquo;
            </p>
          )}

          {/* location / role metadata */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-sm text-slate-300">
            {profile.chamber === "local" && localData ? (
              <>
                {localData.ward_no != null && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <span className="font-semibold text-white">Ward {localData.ward_no}</span>
                  </span>
                )}
                {localData.municipality_name && (
                  <span className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <span>{localData.municipality_name}</span>
                    {localData.province && (
                      <span className="text-slate-500">· {localData.province}</span>
                    )}
                  </span>
                )}
                {localData.muni_code && (
                  <span className="text-slate-600 font-mono text-xs">{localData.muni_code}</span>
                )}
              </>
            ) : (
              <>
                {profile.constituency && <span>{profile.constituency}</span>}
              </>
            )}
            {profile.portfolio && (
              <span className="text-slate-400">{profile.portfolio}</span>
            )}
          </div>

          {/* official profile link */}
          {profile.official_profile_url && (
            <a
              href={profile.official_profile_url}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Official Parliament Profile
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      {/* ── Stat strip ───────────────────────────────────────────────────── */}
      <div className="max-w-5xl -mx-4 sm:-mx-8 px-6 sm:px-10 mb-8 flex flex-wrap gap-6 text-sm border-b border-slate-100 pb-5">
        <StatPill value={flags.length} label={flags.length === 1 ? "flag" : "flags"} highlight={flags.length > 0} />
        <StatPill value={disclosures.length} label={disclosures.length === 1 ? "disclosure" : "disclosures"} />
        {totalDeclared > 0 && (
          <StatPill
            value={`R${(totalDeclared / 1_000_000).toFixed(1)}M`}
            label="declared"
          />
        )}
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="max-w-5xl space-y-10">

        {/* Procurement Connections */}
        <section>
          <SectionHeader label="Procurement Connections" count={procurementFlags.length} countColor="text-red-600" />
          {procurementFlags.length > 0 ? (
            <ul className="flex flex-col gap-3 mt-5">
              {withSource(procurementFlags).map((f) => (
                <li
                  key={f.id}
                  className="relative border-l-[3px] border-red-500 bg-white rounded-r-xl shadow-sm px-5 py-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-red-600 mb-1.5">
                        {flagLabel(f.flag_type)}
                      </p>
                      <p className="text-sm text-slate-800 leading-relaxed">{f.public_text}</p>
                    </div>
                    <div className="flex-shrink-0 mt-0.5">
                      <SourceCitation source={f.source} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 text-sm text-slate-400 italic">
              No procurement relationships detected.
            </p>
          )}
        </section>

        {/* Flags & Observations */}
        <section>
          <SectionHeader label="Flags & Observations" count={otherFlags.length} countColor="text-amber-600" />
          {otherFlags.length > 0 ? (
            <ul className="mt-5 divide-y divide-slate-100 border border-slate-100 rounded-xl bg-white shadow-sm overflow-hidden">
              {withSource(otherFlags).map((f) => {
                const { severity } = flagMeta(f.flag_type);
                const dot =
                  severity === "high" ? "bg-red-500" :
                  severity === "medium" ? "bg-amber-400" : "bg-slate-300";
                return (
                  <li key={f.id} className="flex items-start gap-4 px-5 py-3.5">
                    <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {flagLabel(f.flag_type)}
                      </p>
                      <p className="text-sm text-slate-700 leading-snug">{f.public_text}</p>
                    </div>
                    <div className="flex-shrink-0 mt-0.5">
                      <SourceCitation source={f.source} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-5 text-sm text-slate-400 italic">
              No other flags on record.
            </p>
          )}
        </section>

        {/* Register of Interests */}
        <section>
          <SectionHeader label="Register of Interests" count={disclosures.length} />
          <div className="mt-5">
            <DisclosuresTable rows={withSource(disclosures)} />
          </div>
        </section>

        {/* Disclaimer */}
        <p className="text-[11px] text-slate-400 leading-relaxed pb-4 border-t border-slate-100 pt-5">
          Figures reproduced from official public records. Flags are statistical or documentary
          observations — not findings of wrongdoing. Presumption of innocence applies in all
          pending matters.
        </p>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const CHAMBER_LABEL: Record<string, string> = {
  na: "National Assembly",
  ncop: "National Council of Provinces",
  local: "Local Government",
};

function partyAccent(party: string | null): string {
  if (!party) return "#64748b";
  const p = party.toUpperCase();
  if (p.includes("ANC")) return "#15803d";
  if (p.includes("DA")) return "#1d4ed8";
  if (p.includes("EFF")) return "#b91c1c";
  if (p.includes("MK")) return "#7c3aed";
  if (p.includes("IFP")) return "#c2410c";
  if (p.includes("FF+")) return "#0f766e";
  if (p.includes("ACDP")) return "#4338ca";
  return "#64748b";
}

const FLAG_META: Record<FlagType, { label: string; severity: "high" | "medium" | "info" }> = {
  procurement_relationship:  { label: "Procurement Relationship",   severity: "high"   },
  criminal_charge_pending:   { label: "Criminal Charge (Pending)",  severity: "high"   },
  convicted_final:           { label: "Convicted — Final",          severity: "high"   },
  convicted_appeal_pending:  { label: "Convicted — Appeal Pending", severity: "high"   },
  civil_proceeding:          { label: "Civil Proceeding",           severity: "medium" },
  disclosure_inconsistency:  { label: "Disclosure Inconsistency",   severity: "medium" },
  cipc_directorship_match:   { label: "CIPC Directorship Match",    severity: "medium" },
  outlier_expense:           { label: "Statistical Outlier",        severity: "info"   },
  acquitted:                 { label: "Acquitted",                  severity: "info"   },
};

function flagMeta(type: FlagType) {
  return FLAG_META[type] ?? { label: type, severity: "info" as const };
}

function flagLabel(type: FlagType) {
  return flagMeta(type).label;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatPill({
  value,
  label,
  highlight = false,
}: {
  value: string | number;
  label: string;
  highlight?: boolean;
}) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className={`text-lg font-black tabular-nums leading-none ${highlight ? "text-red-600" : "text-slate-900"}`}>
        {value}
      </span>
      <span className="text-xs text-slate-400 font-medium">{label}</span>
    </span>
  );
}

function SectionHeader({
  label,
  count,
  countColor = "text-slate-500",
}: {
  label: string;
  count: number;
  countColor?: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
        {label}
      </h2>
      <div className="flex-1 h-px bg-slate-100" />
      {count > 0 && (
        <span className={`text-xs font-bold tabular-nums ${countColor}`}>{count}</span>
      )}
    </div>
  );
}
