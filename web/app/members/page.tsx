import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import type { MpPublic } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const { data, error } = await getSupabase()
    .from("v_mps_public")
    .select("id, full_name, known_as, party, chamber")
    .order("full_name");

  if (error) throw new Error(`Failed to load MPs: ${error.message}`);
  const mps: Pick<MpPublic, "id" | "full_name" | "known_as" | "party" | "chamber">[] = data ?? [];

  const naMps = mps.filter(m => m.chamber === "na");
  const ncopMps = mps.filter(m => m.chamber === "ncop");

  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Members of Parliament</h1>
        <p className="text-slate-600">Browse all legislators by chamber</p>
      </div>

      <div className="space-y-8">
        {/* National Assembly */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-6">National Assembly ({naMps.length})</h2>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {naMps.map((mp) => (
              <MemberCard key={mp.id} mp={mp} />
            ))}
          </div>
        </section>

        {/* NCOP */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-6">National Council of Provinces ({ncopMps.length})</h2>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {ncopMps.map((mp) => (
              <MemberCard key={mp.id} mp={mp} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function MemberCard({ mp }: { mp: Pick<MpPublic, "id" | "full_name" | "known_as" | "party" | "chamber"> }) {
  return (
    <Link
      href={`/mps/${mp.id}`}
      className="group p-4 bg-white border rounded-lg hover:border-teal-400 hover:shadow-md hover:bg-teal-50 transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-blue-600 rounded-full flex items-center justify-center text-white flex-shrink-0 text-sm font-semibold">
          {mp.known_as?.[0] ?? mp.full_name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-slate-900 group-hover:text-teal-600 truncate">
            {mp.known_as ?? mp.full_name}
          </p>
          <p className="text-xs text-slate-500 truncate">{mp.party || "Independent"}</p>
        </div>
      </div>
    </Link>
  );
}
