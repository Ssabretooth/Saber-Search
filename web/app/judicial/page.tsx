import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function JudicialPage() {
  const { data, error } = await getSupabase()
    .from("v_judicial_public")
    .select("id, status, case_number, court, summary_neutral, status_as_of")
    .order("status_as_of", { ascending: false })
    .limit(50);

  if (error) throw new Error(`Failed to load judicial data: ${error.message}`);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Judicial Proceedings</h1>
        <p className="text-slate-600">Legal cases involving members of parliament</p>
      </div>
      <div className="bg-white border rounded-lg p-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2 font-semibold">Status</th>
              <th className="text-left p-2 font-semibold">Case</th>
              <th className="text-left p-2 font-semibold">Court</th>
              <th className="text-left p-2 font-semibold">Summary</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((row) => (
              <tr key={row.id} className="border-b hover:bg-slate-50">
                <td className="p-2">
                  <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-medium capitalize">
                    {row.status}
                  </span>
                </td>
                <td className="p-2 text-slate-600">{row.case_number || "—"}</td>
                <td className="p-2 text-slate-600">{row.court || "—"}</td>
                <td className="p-2 text-slate-600 max-w-xs truncate">{row.summary_neutral || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
