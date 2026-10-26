import { getSupabase } from "@/lib/supabase";
import { MembersDirectory } from "./MembersDirectory";
import { MpPublic, MunicipalityPublic } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const supabase = getSupabase();
  const [mpsRes, munisRes] = await Promise.all([
    supabase.from("v_mps_public").select("*").order("full_name"),
    supabase.from("v_municipalities_public").select("*").order("province").order("name"),
  ]);

  if (mpsRes.error) throw new Error(`Failed to load MPs: ${mpsRes.error.message}`);
  if (munisRes.error) throw new Error(`Failed to load municipalities: ${munisRes.error.message}`);

  const mps = (mpsRes.data as MpPublic[]) ?? [];
  const municipalities = (munisRes.data as MunicipalityPublic[]) ?? [];

  return (
    <main className="container mx-auto py-10 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Members & Councillors</h1>
        <p className="text-gray-500 mt-2">
          {mps.length} legislators and councillors · {municipalities.length} municipalities
        </p>
      </div>
      <MembersDirectory mps={mps} municipalities={municipalities} />
    </main>
  );
}
