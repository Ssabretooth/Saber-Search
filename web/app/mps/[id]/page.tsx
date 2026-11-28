import { notFound } from "next/navigation";
import { AlertTriangle, ExternalLink, MapPin, Building2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FlagBadge } from "@/components/FlagBadge";
import { PartyBadge } from "@/components/PartyBadge";
import { SourceCitation } from "@/components/SourceCitation";
import { DisclosuresTable } from "@/components/DisclosuresTable";
import type {
  DisclosurePublic,
  FlagPublic,
  MpPublic,
  SourceDocument,
} from "@/lib/types/database";

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

  return (
    <main className="container mx-auto max-w-5xl space-y-8 px-4 py-10">
      <Alert className="border-amber-200 bg-amber-50 text-amber-900">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertTitle className="font-semibold">Audit Notice</AlertTitle>
        <AlertDescription>
          Figures are reproduced from official public records. Flags are statistical or documentary
          observations, not findings of wrongdoing.
        </AlertDescription>
      </Alert>

      <header className="space-y-3 border-b pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{profile.known_as ?? profile.full_name}</h1>
          <PartyBadge party={profile.party} />
        </div>

        {/* Local councillor: show ward + municipality prominently */}
        {profile.chamber === "local" && localData && (
          <div className="flex flex-wrap gap-3">
            {localData.ward_no != null && (
              <div className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5">
                <MapPin className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span className="text-sm font-semibold text-amber-800">Ward {localData.ward_no}</span>
              </div>
            )}
            {localData.municipality_name && (
              <div className="inline-flex items-center gap-1.5 rounded-lg bg-teal-50 border border-teal-200 px-3 py-1.5">
                <Building2 className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                <span className="text-sm font-semibold text-teal-800">{localData.municipality_name}</span>
                {localData.province && (
                  <span className="text-xs text-teal-600 opacity-70">· {localData.province}</span>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
          {profile.chamber === "local"
            ? (
              <>
                {localData?.muni_code && <span>Code: {localData.muni_code}</span>}
                {profile.portfolio && <span>• {profile.portfolio}</span>}
                <span>• Local Government</span>
              </>
            )
            : (
              <>
                {profile.constituency && <span>• {profile.constituency}</span>}
                {profile.portfolio && <span>• {profile.portfolio}</span>}
                <span>• Chamber: {profile.chamber.toUpperCase()}</span>
              </>
            )
          }
        </div>

        {profile.official_profile_url && (
          <a
            href={profile.official_profile_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            Official Parliament Profile <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </header>

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          Follow the Tender
          {procurementFlags.length > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-800">
              {procurementFlags.length}
            </span>
          )}
        </h2>
        {procurementFlags.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {withSource(procurementFlags).map((f) => (
              <li key={f.id} className="flex flex-col gap-2 rounded-md border border-red-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <FlagBadge flagType={f.flag_type} />
                  <SourceCitation source={f.source} />
                </div>
                <p className="text-sm font-medium text-gray-900">{f.public_text}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-md border border-dashed bg-gray-50 p-4 text-sm text-gray-500">
            No procurement relationships detected for this Member.
          </p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Other Flags</h2>
        {otherFlags.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {withSource(otherFlags).map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-3 rounded-md border bg-white p-3 shadow-sm"
              >
                <FlagBadge flagType={f.flag_type} />
                <span className="flex-1 text-sm text-gray-600">{f.public_text}</span>
                <SourceCitation source={f.source} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-md border border-dashed bg-gray-50 p-4 text-sm text-gray-500">
            No other flags detected for this Member.
          </p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Financial Disclosures</h2>
        <DisclosuresTable rows={withSource(disclosures)} />
      </section>
    </main>
  );
}
