import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function SpendingPage() {
  const { data, error } = await getSupabase()
    .from("v_spending_public")
    .select("id, spend_type, amount_zar, department, period_start")
    .order("period_start", { ascending: false })
    .limit(50);

  if (error) throw new Error(`Failed to load spending data: ${error.message}`);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">State Spending</h1>
        <p className="text-slate-600">Government expenditure allocated to MPs</p>
      </div>
      <div className="bg-white border rounded-lg p-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2 font-semibold">Type</th>
              <th className="text-left p-2 font-semibold">Department</th>
              <th className="text-right p-2 font-semibold">Amount (ZAR)</th>
              <th className="text-left p-2 font-semibold">Period</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((row) => (
              <tr key={row.id} className="border-b hover:bg-slate-50">
                <td className="p-2 capitalize">{row.spend_type}</td>
                <td className="p-2 text-slate-600">{row.department || "—"}</td>
                <td className="p-2 text-right">R{Number(row.amount_zar).toLocaleString()}</td>
                <td className="p-2 text-slate-600">{row.period_start}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
