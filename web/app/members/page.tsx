import { getSupabase } from "@/lib/supabase";
import { MembersDirectory } from "./MembersDirectory";
import { MpPublic } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const { data, error } = await getSupabase()
    .from("v_mps_public")
    .select("*")
    .order("full_name");

  if (error) throw new Error(`Failed to load MPs: ${error.message}`);
  const mps = (data as MpPublic[]) ?? [];

  return (
    <main className="container mx-auto py-10 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Members of Parliament</h1>
        <p className="text-gray-500 mt-2">{mps.length} legislators across both chambers</p>
      </div>
      <MembersDirectory mps={mps} />
    </main>
  );
}
