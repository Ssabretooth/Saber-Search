import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { SpendTable } from "@/components/SpendTable";
import { DisclosuresTable } from "@/components/DisclosuresTable";
import { JudicialTable } from "@/components/JudicialTable";
import { FlagBadge } from "@/components/FlagBadge";
import type { FlagType } from "@/lib/types/flags";

type Mp = {
  id: string;
  full_name: string;
  known_as: string | null;
  chamber: "na" | "ncop";
  party: string | null;
  constituency: string | null;
  portfolio: string | null;
  official_profile_url: string | null;
};

export default async function MpPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: mp } = await supabase
    .from("v_mps_public")
    .select("*")
    .eq("id", id)
    .maybeSingle<Mp>();

  if (!mp) notFound();

  const [spend, disclosures, judicial, flags] = await Promise.all([
    supabase.from("v_spending_public").select("*").eq("mp_id", id),
    supabase.from("v_disclosures_public").select("*").eq("mp_id", id),
    supabase.from("v_judicial_public").select("*").eq("mp_id", id),
    supabase
      .from("v_flags_public")
      .select("id, flag_type")
      .eq("subject_id", id)
      .returns<{ id: string; flag_type: FlagType }[]>(),
  ]);

  return (
    <article className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">{mp.known_as ?? mp.full_name}</h1>
        <p className="text-sm text-slate-600">
          {mp.chamber.toUpperCase()}
          {mp.party ? ` · ${mp.party}` : ""}
          {mp.constituency ? ` · ${mp.constituency}` : ""}
          {mp.portfolio ? ` · ${mp.portfolio}` : ""}
        </p>
      </header>

      <p className="rounded border border-slate-300 bg-slate-50 p-3 text-sm">
        Figures are reproduced from official public records. Flags are statistical or
        documentary observations, not findings of wrongdoing.
      </p>

      {flags.data && flags.data.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Flags</h2>
          <ul className="flex flex-wrap gap-2">
            {flags.data.map((f) => (
              <li key={f.id}>
                <FlagBadge flagType={f.flag_type} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Financial disclosures</h2>
        <DisclosuresTable rows={disclosures.data ?? []} />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">State spending</h2>
        <SpendTable rows={spend.data ?? []} />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Judicial proceedings</h2>
        <JudicialTable rows={judicial.data ?? []} />
      </section>
    </article>
  );
}
