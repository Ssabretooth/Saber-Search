import { FileText } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { PageHeader, DataCard, DataTable } from "@/components/DataComponents";

export const dynamic = "force-dynamic";

export default async function DisclosuresPage() {
  const { data, error } = await getSupabase()
    .from("v_disclosures_public")
    .select("id, category, description, value_zar, counterparty")
    .order("extracted_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(`Failed to load disclosures: ${error.message}`);

  const total = data?.reduce((sum, row) => sum + (Number(row.value_zar) || 0), 0) || 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Financial Disclosures"
        subtitle="Declared interests and assets of members"
      />

      <DataCard
        icon={FileText}
        title="Total Declared Value"
        value={`R${total.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`}
        subtitle={`${data?.length || 0} entries`}
      />

      <DataTable
        headers={["Category", "Description", "Counterparty", "Value (ZAR)"]}
        rows={data?.map((row) => [
          <span key="cat" className="capitalize px-2 py-1 bg-teal-100 text-teal-700 rounded text-xs font-medium">{row.category}</span>,
          row.description || "—",
          row.counterparty || "—",
          row.value_zar ? `R${Number(row.value_zar).toLocaleString()}` : "—"
        ]) || []}
      />
    </div>
  );
}
