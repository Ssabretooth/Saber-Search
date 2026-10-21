import { notFound } from "next/navigation";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FlagBadge } from "@/components/FlagBadge";
import { SourceCitation } from "@/components/SourceCitation";
import { DisclosuresTable } from "@/components/DisclosuresTable";
import { SpendTable } from "@/components/SpendTable";
import { JudicialTable } from "@/components/JudicialTable";
import type {
  DisclosurePublic,
  Flag,
  JudicialPublic,
  MPProfile,
  SourceDocument,
  SpendingPublic,
} from "@/lib/types/database";

type WithSource<T> = T & { source?: SourceDocument };

export default async function MPProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: mp } = await supabase
    .from("v_mps_public")
    .select("*")
    .eq("id", id)
    .maybeSingle<MPProfile>();
  if (!mp) notFound();

  const [flagsRes, disclosuresRes, spendRes, judicialRes] = await Promise.all([
    supabase.from("v_flags_public").select("*").eq("subject_id", id).returns<Flag[]>(),
    supabase
      .from("v_disclosures_public")
      .select("*")
      .eq("mp_id", id)
      .order("extracted_at", { ascending: false })
      .returns<DisclosurePublic[]>(),
    supabase.from("v_spending_public").select("*").eq("mp_id", id).returns<SpendingPublic[]>(),
    supabase.from("v_judicial_public").select("*").eq("mp_id", id).returns<JudicialPublic[]>(),
  ]);

  const flags = flagsRes.data ?? [];
  const disclosures = disclosuresRes.data ?? [];
  const spend = spendRes.data ?? [];
  const judicial = judicialRes.data ?? [];

  const sourceIds = [
    ...new Set([...flags, ...disclosures, ...spend, ...judicial].map((r) => r.source_document_id)),
  ];
  const { data: sources } = sourceIds.length
    ? await supabase
        .from("v_sources_public")
        .select("id, publisher, title, url, published_at, licence_note")
        .in("id", sourceIds)
        .returns<SourceDocument[]>()
    : { data: [] as SourceDocument[] };
  const sourceById = new Map((sources ?? []).map((s) => [s.id, s]));

  const withSource = <T extends { source_document_id: string }>(rows: T[]): WithSource<T>[] =>
    rows.map((r) => ({ ...r, source: sourceById.get(r.source_document_id) }));

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

      <header className="space-y-2 border-b pb-6">
        <h1 className="text-3xl font-bold tracking-tight">{mp.known_as ?? mp.full_name}</h1>
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          {mp.party && <p className="font-medium">{mp.party}</p>}
          {mp.constituency && <p>• {mp.constituency}</p>}
          {mp.portfolio && <p>• {mp.portfolio}</p>}
          <p>• Chamber: {mp.chamber.toUpperCase()}</p>
        </div>
        {mp.official_profile_url && (
          <a
            href={mp.official_profile_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            Official Parliament Profile <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Active Flags</h2>
        {flags.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {withSource(flags).map((f) => (
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
            No active flags detected for this Member.
          </p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Financial Disclosures</h2>
        <DisclosuresTable rows={withSource(disclosures)} />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">State Spending</h2>
        <SpendTable rows={withSource(spend)} />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Judicial Proceedings</h2>
        <JudicialTable rows={withSource(judicial)} />
      </section>
    </main>
  );
}
