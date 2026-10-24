import { Gavel } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { PageHeader, DataCard, DataTable } from "@/components/DataComponents";

export const dynamic = "force-dynamic";

export default async function JudicialPage() {
  const { data, error } = await getSupabase()
    .from("v_judicial_public")
    .select("id, status, case_number, court, summary_neutral, status_as_of")
    .order("status_as_of", { ascending: false })
    .limit(100);

  if (error) throw new Error(`Failed to load judicial data: ${error.message}`);

  const statusCounts = data?.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <div className="space-y-8">
      <PageHeader
        title="Judicial Proceedings"
        subtitle="Legal cases involving members of parliament"
      />

      <DataCard
        icon={Gavel}
        title="Active Cases"
        value={data?.length || 0}
        subtitle={`${Object.keys(statusCounts).length} different statuses`}
      />

      <DataTable
        headers={["Status", "Case Number", "Court", "Summary"]}
        rows={data?.map((row) => {
          const summary = row.summary_neutral ? String(row.summary_neutral).substring(0, 50) + "..." : "—";
          return [
            <span key="status" className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium capitalize">{row.status}</span>,
            row.case_number || "—",
            row.court || "—",
            summary
          ];
        }) || []}
      />
    </div>
  );
}
