"use client";

import { useState } from "react";
import Link from "next/link";
import { UserCircle, ChevronDown } from "lucide-react";
import { MpPublic } from "@/lib/types/database";
import { PartyBadge } from "@/components/PartyBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MembersDirectory({ mps }: { mps: MpPublic[] }) {
  const [chamber, setChamber] = useState<"na" | "ncop" | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const naMps = mps.filter((m) => m.chamber === "na");
  const ncopMps = mps.filter((m) => m.chamber === "ncop");

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
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="cursor-pointer hover:border-green-500 transition-colors" onClick={() => setChamber("na")}>
          <CardHeader>
            <CardTitle className="text-2xl">National Assembly</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-green-700">{naMps.length}</p>
            <p className="text-sm text-gray-500 mt-1">Main legislative chamber</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-green-500 transition-colors" onClick={() => setChamber("ncop")}>
          <CardHeader>
            <CardTitle className="text-2xl">National Council of Provinces</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-green-700">{ncopMps.length}</p>
            <p className="text-sm text-gray-500 mt-1">Provincial representation</p>
          </CardContent>
        </Card>
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
