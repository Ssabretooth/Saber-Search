import { TrendingUp } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { PageHeader, DataCard, DataTable } from "@/components/DataComponents";

export const dynamic = "force-dynamic";

export default async function SpendingPage() {
  const { data, error } = await getSupabase()
    .from("v_spending_public")
    .select("id, spend_type, amount_zar, department, period_start")
    .order("period_start", { ascending: false })
    .limit(100);

  if (error) throw new Error(`Failed to load spending data: ${error.message}`);

  const total = data?.reduce((sum, row) => sum + Number(row.amount_zar), 0) || 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="State Spending"
        subtitle="Government expenditure allocated to members"
      />

      <DataCard
        icon={TrendingUp}
        title="Total Expenditure"
        value={`R${total.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`}
        subtitle={`${data?.length || 0} transactions`}
      />

      <DataTable
        headers={["Type", "Department", "Amount (ZAR)", "Period"]}
        rows={data?.map((row) => [
          <span key="type" className="capitalize px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">{row.spend_type}</span>,
          row.department || "—",
          `R${Number(row.amount_zar).toLocaleString()}`,
          row.period_start
        ]) || []}
      />
    </div>
  );
}
