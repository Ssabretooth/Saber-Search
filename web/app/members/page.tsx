import Link from "next/link";
import { Users } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { PageHeader, DataCard } from "@/components/DataComponents";
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
      <PageHeader
        title="Members of Parliament"
        subtitle={`${mps.length} legislators across both chambers`}
      />

      <div className="grid md:grid-cols-2 gap-6">
        <DataCard icon={Users} title="National Assembly" value={naMps.length} subtitle="Main legislative chamber" />
        <DataCard icon={Users} title="National Council of Provinces" value={ncopMps.length} subtitle="Provincial representation" />
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <div className="w-1 h-6 bg-teal-600 rounded" />
            National Assembly
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {naMps.map((mp) => (
              <MemberCard key={mp.id} mp={mp} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <div className="w-1 h-6 bg-blue-600 rounded" />
            National Council of Provinces
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
      className="group p-3 bg-white border rounded-lg hover:border-teal-400 hover:shadow-md hover:bg-teal-50 transition-all"
    >
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-blue-600 rounded-full flex items-center justify-center text-white flex-shrink-0 text-xs font-bold">
          {mp.known_as?.[0] ?? mp.full_name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-xs text-slate-900 group-hover:text-teal-600 truncate leading-tight">
            {mp.known_as ?? mp.full_name}
          </p>
          <p className="text-xs text-slate-500 truncate">{mp.party || "Independent"}</p>
        </div>
      </div>
    </Link>
  );
}
