"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, MapPin, Users, Building2, ChevronDown, ExternalLink } from "lucide-react";
import { MpPublic, MunicipalityPublic } from "@/lib/types/database";
import { normalizeProvince, councillorWardNo, muniCodeFromConstituency, councillorMunicipality } from "@/lib/municipalities";

type Props = {
  municipalities: MunicipalityPublic[];
  councillors: MpPublic[];
};

const PARTY_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  "African National Congress": { bg: "bg-green-100", text: "text-green-800", bar: "#16a34a" },
  "Democratic Alliance":        { bg: "bg-blue-100",  text: "text-blue-800",  bar: "#2563eb" },
  "uMkhonto weSizwe Party":     { bg: "bg-purple-100",text: "text-purple-800",bar: "#7c3aed" },
  "Inkatha Freedom Party":      { bg: "bg-orange-100",text: "text-orange-800",bar: "#ea580c" },
  "Economic Freedom Fighters":  { bg: "bg-red-100",   text: "text-red-800",   bar: "#dc2626" },
  "ActionSA":                   { bg: "bg-cyan-100",  text: "text-cyan-800",  bar: "#0891b2" },
  "Patriotic Alliance":         { bg: "bg-yellow-100",text: "text-yellow-800",bar: "#ca8a04" },
  "Independent":                { bg: "bg-gray-100",  text: "text-gray-700",  bar: "#6b7280" },
};

function partyStyle(party: string | null) {
  return PARTY_COLORS[party ?? ""] ?? { bg: "bg-slate-100", text: "text-slate-700", bar: "#94a3b8" };
}

function PartyChip({ party }: { party: string | null }) {
  const s = partyStyle(party);
  return (
    <span className={`inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
      {party ?? "Unknown"}
    </span>
  );
}

export function LocalGovernment({ municipalities, councillors }: Props) {
  const [search, setSearch] = useState("");
  const [province, setProvince] = useState<string>("all");
  const [openMunis, setOpenMunis] = useState<Set<string>>(new Set());

  // Build lookups: by demarcation_code (new format) and by name (legacy PDF format)
  const muniByCode = useMemo(
    () => new Map(municipalities.map((m) => [m.demarcation_code, m])),
    [municipalities],
  );
  const muniByName = useMemo(
    () => new Map(municipalities.map((m) => [m.name.toLowerCase(), m])),
    [municipalities],
  );

  // Enrich each councillor with parsed ward data
  const enriched = useMemo(() => {
    return councillors.map((c) => {
      const code = muniCodeFromConstituency(c.constituency);
      let muni = code ? (muniByCode.get(code) ?? null) : null;
      // Fallback: legacy "City of Johannesburg - WD71/ REGION C" format
      if (!muni) {
        const nameKey = councillorMunicipality(c.constituency)?.toLowerCase();
        if (nameKey) muni = muniByName.get(nameKey) ?? null;
      }
      const resolvedCode = muni?.demarcation_code ?? code ?? null;
      return {
        ...c,
        muni_code: resolvedCode,
        ward_no: councillorWardNo(c.constituency),
        municipality_name: muni?.name ?? code ?? "Unknown",
        province: normalizeProvince(muni?.province ?? null),
      };
    });
  }, [councillors, muniByCode, muniByName]);

  // Party totals for breakdown bar
  const partyTotals = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of enriched) {
      const p = c.party ?? "Unknown";
      counts[p] = (counts[p] ?? 0) + 1;
    }
    return Object.entries(counts).sort(([, a], [, b]) => b - a);
  }, [enriched]);

  const total = enriched.length;

  // Province list
  const provinces = useMemo(() => {
    const ps = [...new Set(enriched.map((c) => c.province))].filter(Boolean).sort();
    return ps;
  }, [enriched]);

  // Filter + group by municipality
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((c) => {
      if (province !== "all" && c.province !== province) return false;
      if (!q) return true;
      return (
        c.full_name.toLowerCase().includes(q) ||
        (c.municipality_name ?? "").toLowerCase().includes(q) ||
        (c.muni_code ?? "").toLowerCase().includes(q) ||
        (c.province ?? "").toLowerCase().includes(q) ||
        (c.constituency ?? "").toLowerCase().includes(q) ||
        (c.party ?? "").toLowerCase().includes(q) ||
        (c.ward_no != null && (`ward ${c.ward_no}` === q || `w${c.ward_no}` === q || String(c.ward_no) === q))
      );
    });
  }, [enriched, search, province]);

  const byMuni = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const c of filtered) {
      const key = c.muni_code ?? "unknown";
      map.set(key, [...(map.get(key) ?? []), c]);
    }
    // Sort wards within each municipality
    for (const [k, v] of map.entries()) {
      map.set(k, v.sort((a, b) => (a.ward_no ?? 999) - (b.ward_no ?? 999)));
    }
    return map;
  }, [filtered]);

  // Sort municipalities: by province then name
  const muniList = useMemo(() => {
    return [...byMuni.keys()]
      .map((code) => {
        const rows = byMuni.get(code)!;
        const muni = muniByCode.get(code);
        return {
          code,
          name: muni?.name ?? code,
          province: normalizeProvince(muni?.province ?? null),
          category: muni?.category ?? "B",
          rows,
        };
      })
      .sort((a, b) => a.province.localeCompare(b.province) || a.name.localeCompare(b.name));
  }, [byMuni, muniByCode]);

  const toggle = (code: string) =>
    setOpenMunis((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });

  const matchedMunis = new Set(muniList.map((m) => m.code)).size;

  return (
    <div className="space-y-0">
      {/* Hero stats */}
      <div className="bg-[#0f1a2e] rounded-2xl px-5 py-6 md:px-8 md:py-8 mb-6">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-amber-400 mb-2">2026 Local Government Elections</p>
        <h2 className="text-2xl md:text-3xl font-black text-white mb-1">Ward Councillors</h2>
        <p className="text-sm text-slate-400 mb-6">
          Elected November 4 2026 · IEC certified results · all 213 municipalities
        </p>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { icon: Users, val: total.toLocaleString("en-ZA"), label: "Councillors" },
            { icon: Building2, val: matchedMunis.toLocaleString("en-ZA"), label: "Municipalities" },
            { icon: MapPin, val: "9", label: "Provinces" },
          ].map(({ icon: Icon, val, label }) => (
            <div key={label} className="bg-white/5 rounded-xl px-3 py-3 text-center">
              <Icon className="w-4 h-4 text-amber-400 mx-auto mb-1" />
              <p className="text-xl font-black text-white tabular-nums">{val}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</p>
            </div>
          ))}
        </div>

        {/* Party breakdown bar */}
        <div className="mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">Party breakdown · ward seats won</p>
          <div className="flex h-3 rounded-full overflow-hidden gap-px">
            {partyTotals.slice(0, 8).map(([party, count]) => (
              <div
                key={party}
                style={{ width: `${(count / total) * 100}%`, backgroundColor: partyStyle(party).bar }}
                title={`${party}: ${count}`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {partyTotals.slice(0, 6).map(([party, count]) => (
              <div key={party} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: partyStyle(party).bar }} />
                <span className="text-[10px] text-slate-300">
                  {party.replace("African National Congress", "ANC")
                    .replace("Democratic Alliance", "DA")
                    .replace("uMkhonto weSizwe Party", "MK")
                    .replace("Inkatha Freedom Party", "IFP")
                    .replace("Economic Freedom Fighters", "EFF")}
                  {" "}<span className="text-slate-500">{count}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            placeholder="Search name, municipality, ward number, party, code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setProvince("all")}
            className={`flex-shrink-0 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${province === "all" ? "bg-[#0f1a2e] text-white border-[#0f1a2e]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
          >
            All
          </button>
          {provinces.map((p) => (
            <button
              key={p}
              onClick={() => setProvince(p === province ? "all" : p)}
              className={`flex-shrink-0 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${province === p ? "bg-[#0f1a2e] text-white border-[#0f1a2e]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
            >
              {p.replace("KwaZulu-Natal", "KZN").replace("Northern Cape", "N Cape").replace("Western Cape", "W Cape").replace("Eastern Cape", "E Cape").replace("North West", "NW").replace("Free State", "FS")}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        {filtered.length.toLocaleString("en-ZA")} councillors · {muniList.length} municipalities
        {search || province !== "all" ? " (filtered)" : ""}
      </p>

      {/* Municipality cards */}
      <div className="space-y-2">
        {muniList.map(({ code, name, province: prov, category, rows }) => {
          const isOpen = openMunis.has(code);
          const catLabel = category === "A" ? "Metro" : category === "C" ? "District" : "Local";

          // Mini party bar for this municipality
          const muniParty: Record<string, number> = {};
          for (const r of rows) muniParty[r.party ?? "Unknown"] = (muniParty[r.party ?? "Unknown"] ?? 0) + 1;
          const muniPartyList = Object.entries(muniParty).sort(([, a], [, b]) => b - a);
          const winner = muniPartyList[0];

          return (
            <div key={code} className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => toggle(code)}
                aria-expanded={isOpen}
                className="w-full text-left px-4 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm md:text-base text-gray-900 leading-tight">{name}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        {catLabel}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">{code}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{prov}</p>
                    {winner && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex h-1.5 w-24 rounded-full overflow-hidden gap-px">
                          {muniPartyList.slice(0, 5).map(([p, c]) => (
                            <div key={p} style={{ width: `${(c / rows.length) * 100}%`, backgroundColor: partyStyle(p).bar }} />
                          ))}
                        </div>
                        <span className="text-[10px] text-gray-500">
                          {winner[0].replace("African National Congress", "ANC").replace("Democratic Alliance", "DA").replace("uMkhonto weSizwe Party", "MK").replace("Inkatha Freedom Party", "IFP")} leads
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs font-semibold text-gray-700 tabular-nums">
                      {rows.length} ward{rows.length !== 1 ? "s" : ""}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-gray-100">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 w-16">Ward</th>
                          <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">Councillor</th>
                          <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 hidden sm:table-cell">Party</th>
                          <th className="px-2 py-2 w-8" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {rows.map((c) => (
                          <tr key={c.id} className="hover:bg-amber-50/40 transition-colors group">
                            <td className="px-4 py-2.5 text-xs font-mono font-semibold text-gray-500">
                              {c.ward_no != null ? `W${c.ward_no}` : "PR"}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0">
                                <Link
                                  href={`/mps/${c.id}`}
                                  className="font-medium text-gray-900 hover:text-amber-700 hover:underline leading-tight"
                                >
                                  {c.full_name}
                                </Link>
                                <span className="sm:hidden">
                                  <PartyChip party={c.party} />
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 hidden sm:table-cell">
                              <PartyChip party={c.party} />
                            </td>
                            <td className="px-2 py-2.5">
                              <Link
                                href={`/mps/${c.id}`}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-amber-600"
                                aria-label={`View ${c.full_name}'s profile`}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {muniList.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Search className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No councillors match your search.</p>
        </div>
      )}
    </div>
  );
}
