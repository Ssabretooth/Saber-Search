"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { UserCircle, ChevronDown } from "lucide-react";
import { MpPublic, MunicipalityPublic } from "@/lib/types/database";
import { PartyBadge } from "@/components/PartyBadge";
import { LocalGovernment } from "./LocalGovernment";

const PAGE = 1000;

export function MembersDirectory({
  naMps,
  ncopMps,
  localCount,
  municipalities,
}: {
  naMps: MpPublic[];
  ncopMps: MpPublic[];
  localCount: number;
  municipalities: MunicipalityPublic[];
}) {
  const [chamber, setChamber] = useState<"na" | "ncop" | "local" | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  // Local councillors are fetched on demand to avoid loading 100k rows upfront
  const [localMps, setLocalMps] = useState<MpPublic[]>([]);
  const [localLoading, setLocalLoading] = useState(false);

  useEffect(() => {
    if (chamber !== "local" || localMps.length > 0) return;
    setLocalLoading(true);

    async function fetchAll() {
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const rows: MpPublic[] = [];
      let offset = 0;
      while (true) {
        const { data, error } = await sb
          .from("v_mps_public")
          .select("*")
          .eq("chamber", "local")
          .order("full_name")
          .range(offset, offset + PAGE - 1);
        if (error || !data?.length) break;
        rows.push(...(data as MpPublic[]));
        if (data.length < PAGE) break;
        offset += PAGE;
      }
      setLocalMps(rows);
      setLocalLoading(false);
    }

    fetchAll();
  }, [chamber, localMps.length]);

  const naGrouped = naMps.reduce((acc, mp) => {
    const party = mp.party || "Unknown / Independent";
    (acc[party] ??= []).push(mp);
    return acc;
  }, {} as Record<string, MpPublic[]>);

  const ncopGrouped = ncopMps.reduce((acc, mp) => {
    const province = mp.constituency || "Unassigned Province";
    (acc[province] ??= []).push(mp);
    return acc;
  }, {} as Record<string, MpPublic[]>);

  if (!chamber) {
    return (
      <div className="grid md:grid-cols-3 gap-6">
        <div className="cursor-pointer border rounded-xl p-6 bg-white shadow-sm hover:border-green-500 transition-colors" onClick={() => setChamber("na")}>
          <h2 className="text-2xl font-semibold mb-2">National Assembly</h2>
          <p className="text-4xl font-bold text-green-700">{naMps.length.toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-1">Main legislative chamber</p>
        </div>
        <div className="cursor-pointer border rounded-xl p-6 bg-white shadow-sm hover:border-green-500 transition-colors" onClick={() => setChamber("ncop")}>
          <h2 className="text-2xl font-semibold mb-2">National Council of Provinces</h2>
          <p className="text-4xl font-bold text-green-700">{ncopMps.length.toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-1">Provincial representation</p>
        </div>
        <div className="cursor-pointer border rounded-xl p-6 bg-white shadow-sm hover:border-green-500 transition-colors" onClick={() => setChamber("local")}>
          <h2 className="text-2xl font-semibold mb-2">Local Government</h2>
          <p className="text-4xl font-bold text-green-700">{localCount.toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-1">2026 LGE ward councillors</p>
          <p className="text-xs text-green-700 mt-2 bg-green-50 rounded px-2 py-1">
            4 432 ward winners · 268 metro councillors · 2026 election
          </p>
        </div>
      </div>
    );
  }

  if (chamber === "local") {
    return (
      <div className="space-y-6">
        <button onClick={() => setChamber(null)} className="text-sm text-gray-500 hover:text-black">
          ← Back to Chambers
        </button>
        <h2 className="text-2xl font-bold border-l-4 border-green-700 pl-3">Local Government</h2>
        {localLoading && localMps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
            <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm">Loading {localCount.toLocaleString()} councillors…</p>
          </div>
        ) : (
          <LocalGovernment municipalities={municipalities} councillors={localMps} />
        )}
      </div>
    );
  }

  const groupedData = chamber === "na" ? naGrouped : ncopGrouped;
  const chamberTitle = chamber === "na" ? "National Assembly" : "National Council of Provinces";

  const toggle = (name: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  return (
    <div className="space-y-6">
      <button onClick={() => { setChamber(null); setOpenGroups(new Set()); }} className="text-sm text-gray-500 hover:text-black">
        ← Back to Chambers
      </button>
      <h2 className="text-2xl font-bold border-l-4 border-green-700 pl-3">{chamberTitle}</h2>

      <div className="space-y-4">
        {Object.entries(groupedData)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([groupName, groupMps]) => {
            const isOpen = openGroups.has(groupName);
            return (
              <div key={groupName} className="border rounded-lg bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => toggle(groupName)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-lg">{groupName}</span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{groupMps.length}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 px-4 pb-4">
                    {groupMps.map((mp) => (
                      <Link key={mp.id} href={`/mps/${mp.id}`}>
                        <div className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all">
                          <UserCircle className="w-8 h-8 text-gray-400" />
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-medium leading-tight">{mp.full_name}</span>
                            <PartyBadge party={mp.party} />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
