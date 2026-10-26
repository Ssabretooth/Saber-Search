"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, UserCircle } from "lucide-react";
import { MpPublic, MunicipalityPublic } from "@/lib/types/database";
import { PartyBadge } from "@/components/PartyBadge";
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  councillorMunicipality,
  councillorWard,
  normalizeProvince,
} from "@/lib/municipalities";

type Props = {
  municipalities: MunicipalityPublic[];
  councillors: MpPublic[];
};

function categoryRank(category: string | null): number {
  const i = CATEGORY_ORDER.indexOf((category ?? "") as (typeof CATEGORY_ORDER)[number]);
  return i === -1 ? CATEGORY_ORDER.length : i;
}

export function LocalGovernment({ municipalities, councillors }: Props) {
  const [open, setOpen] = useState<Set<string>>(new Set());

  const { provinces, councillorsByMunicipality, unmatched } = useMemo(() => {
    const knownNames = new Set(municipalities.map((m) => m.name));
    const byName = new Map<string, MpPublic[]>();
    const unmatchedMps: MpPublic[] = [];
    for (const mp of councillors) {
      const name = councillorMunicipality(mp.constituency);
      if (name && knownNames.has(name)) {
        byName.set(name, [...(byName.get(name) ?? []), mp]);
      } else {
        unmatchedMps.push(mp);
      }
    }

    const grouped = new Map<string, MunicipalityPublic[]>();
    for (const m of municipalities) {
      const p = normalizeProvince(m.province);
      grouped.set(p, [...(grouped.get(p) ?? []), m]);
    }
    const provinceList = [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([province, list]) => ({
        province,
        municipalities: list.sort(
          (a, b) => categoryRank(a.category) - categoryRank(b.category) || a.name.localeCompare(b.name),
        ),
      }));

    return {
      provinces: provinceList,
      councillorsByMunicipality: byName,
      unmatched: unmatchedMps,
    };
  }, [municipalities, councillors]);

  const toggle = (code: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });

  return (
    <div className="space-y-12">
      {provinces.map(({ province, municipalities: list }) => {
        const councillorCount = list.reduce(
          (n, m) => n + (councillorsByMunicipality.get(m.name)?.length ?? 0),
          0,
        );
        const categories = [
          ...CATEGORY_ORDER,
          ...Array.from(new Set(list.map((m) => m.category ?? "")))
            .filter((c) => !(CATEGORY_ORDER as readonly string[]).includes(c)),
        ];

        return (
          <section key={province}>
            <header className="flex items-baseline justify-between border-b border-gray-300 pb-2 mb-6">
              <h2 className="text-2xl font-semibold">{province}</h2>
              <p className="text-sm text-gray-500">
                {list.length} municipalities · {councillorCount} councillors loaded
              </p>
            </header>

            {categories.map((cat) => {
              const inCategory = list.filter((m) => (m.category ?? "") === cat);
              if (inCategory.length === 0) return null;
              const label = CATEGORY_LABEL[cat] ?? (cat ? `Category ${cat}` : "Uncategorised");

              return (
                <div key={cat || "none"} className="mb-6">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                    {label}{cat ? ` (${cat})` : ""} · {inCategory.length}
                  </h3>
                  <div className="border rounded-lg bg-white shadow-sm divide-y">
                    {inCategory.map((m) => {
                      const members = councillorsByMunicipality.get(m.name) ?? [];
                      const isOpen = open.has(m.demarcation_code);
                      return (
                        <div key={m.demarcation_code}>
                          <button
                            type="button"
                            onClick={() => toggle(m.demarcation_code)}
                            aria-expanded={isOpen}
                            className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left hover:bg-gray-50"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{m.name}</span>
                              {m.long_name && m.long_name !== m.name && (
                                <span className="text-xs text-gray-500">{m.long_name}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              {m.population != null && (
                                <span className="hidden sm:inline">
                                  {m.population.toLocaleString("en-ZA")} residents
                                </span>
                              )}
                              <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">
                                {members.length} councillors
                              </span>
                              <ChevronDown
                                className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                              />
                            </div>
                          </button>
                          {isOpen && (
                            <div className="px-4 pb-4">
                              {members.length === 0 ? (
                                <p className="text-sm text-gray-500 py-2">
                                  No councillor records loaded for this municipality yet.
                                </p>
                              ) : (
                                <CouncillorTable members={members} />
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}

      {unmatched.length > 0 && (
        <section>
          <header className="flex items-baseline justify-between border-b border-gray-300 pb-2 mb-6">
            <h2 className="text-2xl font-semibold">Not matched to a municipality</h2>
            <p className="text-sm text-gray-500">{unmatched.length} councillors</p>
          </header>
          <CouncillorTable members={unmatched} />
        </section>
      )}
    </div>
  );
}

function CouncillorTable({ members }: { members: MpPublic[] }) {
  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
          <tr>
            <th className="px-3 py-2 font-semibold">Councillor</th>
            <th className="px-3 py-2 font-semibold">Party</th>
            <th className="px-3 py-2 font-semibold">Ward / PR</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {members.map((mp) => (
            <tr key={mp.id} className="hover:bg-gray-50">
              <td className="px-3 py-2">
                <Link href={`/mps/${mp.id}`} className="flex items-center gap-2 hover:underline">
                  <UserCircle className="w-5 h-5 text-gray-400" />
                  {mp.full_name}
                </Link>
              </td>
              <td className="px-3 py-2">
                <PartyBadge party={mp.party} />
              </td>
              <td className="px-3 py-2 text-gray-600">
                {councillorWard(mp.constituency) ?? "Not stated in source"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
