import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function DisclosuresPage() {
  const { data, error } = await getSupabase()
    .from("v_disclosures_public")
    .select("id, mp_id, category, description, value_zar")
    .order("extracted_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(`Failed to load disclosures: ${error.message}`);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Financial Disclosures</h1>
        <p className="text-slate-600">Declared interests and assets of MPs</p>
      </div>
      <div className="bg-white border rounded-lg p-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2 font-semibold">Category</th>
              <th className="text-left p-2 font-semibold">Description</th>
              <th className="text-right p-2 font-semibold">Value (ZAR)</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((row) => (
              <tr key={row.id} className="border-b hover:bg-slate-50">
                <td className="p-2 capitalize">{row.category}</td>
                <td className="p-2 text-slate-600">{row.description || "—"}</td>
                <td className="p-2 text-right">{row.value_zar ? `R${Number(row.value_zar).toLocaleString()}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
