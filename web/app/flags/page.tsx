import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function FlagsPage() {
  const { data, error } = await getSupabase()
    .from("v_flags_public")
    .select("id, flag_type, public_text, rule_id")
    .order("reviewed_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(`Failed to load flags: ${error.message}`);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Alerts & Flags</h1>
        <p className="text-slate-600">Statistical observations and notable patterns</p>
      </div>
      <div className="bg-white border rounded-lg p-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2 font-semibold">Type</th>
              <th className="text-left p-2 font-semibold">Description</th>
              <th className="text-left p-2 font-semibold">Rule</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((row) => (
              <tr key={row.id} className="border-b hover:bg-slate-50">
                <td className="p-2">
                  <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-medium capitalize">
                    {row.flag_type}
                  </span>
                </td>
                <td className="p-2 text-slate-600">{row.public_text}</td>
                <td className="p-2 text-slate-500 text-xs font-mono">{row.rule_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
