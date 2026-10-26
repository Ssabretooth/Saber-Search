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

export function councillorMunicipality(constituency: string | null): string | null {
  if (!constituency) return null;
  return constituency.split(" - ")[0].trim();
}

export function councillorWard(constituency: string | null): string | null {
  if (!constituency || !constituency.includes(" - ")) return null;
  return constituency.split(" - ").slice(1).join(" - ").trim();
}
