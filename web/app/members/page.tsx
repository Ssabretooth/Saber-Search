import { getSupabase } from "@/lib/supabase";
import { MembersDirectory } from "./MembersDirectory";
import { MpPublic, MunicipalityPublic } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const supabase = getSupabase();

  // Query NA and NCOP fully (small enough); get local count separately
  // to avoid hitting Supabase's default 1 000-row limit on a 100k+ table.
  const [naRes, ncopRes, localCountRes, munisRes] = await Promise.all([
    supabase.from("v_mps_public").select("*").eq("chamber", "na").not("term_start", "is", null).order("full_name"),
    supabase.from("v_mps_public").select("*").eq("chamber", "ncop").not("term_start", "is", null).order("full_name"),
    supabase.from("v_mps_public").select("id", { count: "exact", head: true }).eq("chamber", "local"),
    supabase.from("v_municipalities_public").select("*").order("province").order("name"),
  ]);

  if (naRes.error) throw new Error(`Failed to load NA MPs: ${naRes.error.message}`);
  if (ncopRes.error) throw new Error(`Failed to load NCOP MPs: ${ncopRes.error.message}`);
  if (munisRes.error) throw new Error(`Failed to load municipalities: ${munisRes.error.message}`);

  const naMps = (naRes.data as MpPublic[]) ?? [];
  const ncopMps = (ncopRes.data as MpPublic[]) ?? [];
  const localCount = localCountRes.count ?? 0;
  const municipalities = (munisRes.data as MunicipalityPublic[]) ?? [];

  const totalLegislators = naMps.length + ncopMps.length + localCount;

  return (
    <main className="container mx-auto py-10 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Members & Councillors</h1>
        <p className="text-gray-500 mt-2">
          {totalLegislators.toLocaleString()} legislators and councillors · {municipalities.length} municipalities
        </p>
      </div>
      <MembersDirectory
        naMps={naMps}
        ncopMps={ncopMps}
        localCount={localCount}
        municipalities={municipalities}
      />
    </main>
  );
}
