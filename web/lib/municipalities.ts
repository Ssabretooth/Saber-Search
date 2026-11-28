const PROVINCE_ALIASES: Record<string, string> = {
  "Kwazulu-Natal": "KwaZulu-Natal",
};

export const CATEGORY_ORDER = ["A", "B", "C"] as const;

export const CATEGORY_LABEL: Record<string, string> = {
  A: "Metropolitan",
  B: "Local",
  C: "District",
};

export function normalizeProvince(province: string | null): string {
  if (!province) return "Unknown province";
  return PROVINCE_ALIASES[province] ?? province;
}

// Legacy format: "City of Johannesburg - WD71/ REGION C"
export function councillorMunicipality(constituency: string | null): string | null {
  if (!constituency) return null;
  if (constituency.includes(" - ")) return constituency.split(" - ")[0].trim();
  // New format: "JHB Ward 1" — return the muni code part
  if (constituency.includes(" Ward ")) return constituency.split(" Ward ")[0].trim();
  return constituency.trim();
}

export function councillorWard(constituency: string | null): string | null {
  if (!constituency) return null;
  if (constituency.includes(" - ")) return constituency.split(" - ").slice(1).join(" - ").trim();
  if (constituency.includes(" Ward ")) return "Ward " + constituency.split(" Ward ")[1].trim();
  return null;
}

export function councillorWardNo(constituency: string | null): number | null {
  if (!constituency || !constituency.includes(" Ward ")) return null;
  const n = parseInt(constituency.split(" Ward ")[1], 10);
  return isNaN(n) ? null : n;
}

export function muniCodeFromConstituency(constituency: string | null): string | null {
  if (!constituency) return null;
  if (constituency.includes(" Ward ")) return constituency.split(" Ward ")[0].trim();
  return null;
}
