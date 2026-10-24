import { AlertCircle } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { PageHeader, DataCard, DataTable } from "@/components/DataComponents";

export const dynamic = "force-dynamic";

export default async function FlagsPage() {
  const { data, error } = await getSupabase()
    .from("v_flags_public")
    .select("id, flag_type, public_text, rule_id")
    .order("reviewed_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(`Failed to load flags: ${error.message}`);

  const typeCount = data?.reduce((acc, row) => {
    acc[row.flag_type] = (acc[row.flag_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <div className="space-y-8">
      <PageHeader
        title="Alerts & Flags"
        subtitle="Statistical observations and notable patterns"
      />

      <DataCard
        icon={AlertCircle}
        title="Total Flags"
        value={data?.length || 0}
        subtitle={`${Object.keys(typeCount).length} flag types`}
      />

      <DataTable
        headers={["Type", "Description", "Rule ID"]}
        rows={data?.map((row) => [
          <span key="type" className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium capitalize">{row.flag_type}</span>,
          row.public_text,
          <span key="id" className="font-mono text-xs text-slate-500">{row.rule_id}</span>
        ]) || []}
      />
    </div>
  );
}
