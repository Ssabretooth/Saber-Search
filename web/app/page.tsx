import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import type { MpPublic } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { data, error } = await getSupabase()
    .from("v_mps_public")
    .select("id, full_name, known_as, party")
    .order("full_name");

  if (error) throw new Error(`Failed to load MPs: ${error.message}`);
  const mps: Pick<MpPublic, "id" | "full_name" | "known_as" | "party">[] = data ?? [];

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Members of Parliament</h1>
      <ul className="grid gap-2 sm:grid-cols-2">
        {mps.map((mp) => (
          <li key={mp.id}>
            <Link
              href={`/mps/${mp.id}`}
              className="block rounded-md border bg-white p-3 text-sm hover:bg-slate-50"
            >
              <span className="font-medium">{mp.known_as ?? mp.full_name}</span>
              {mp.party && <span className="ml-2 text-gray-500">{mp.party}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
