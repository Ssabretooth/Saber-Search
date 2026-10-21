import { Badge } from "@/components/ui/badge";
import type { FlagType } from "@/lib/types/flags";

type Tone = "neutral" | "review";

function flagLabel(flagType: FlagType): string {
  switch (flagType) {
    case "outlier_expense":
      return "Statistical outlier — see methodology";
    case "disclosure_inconsistency":
      return "Disclosure inconsistency — under review";
    case "cipc_directorship_match":
      return "Registered directorship match — under review";
    case "procurement_relationship":
      return "Procurement relationship — see source record";
    case "civil_proceeding":
      return "Civil proceeding — official record";
    case "criminal_charge_pending":
      return "Criminal charge pending — presumption of innocence applies";
    case "acquitted":
      return "Acquitted — official record";
    case "convicted_appeal_pending":
      return "Convicted, appeal pending — official record";
    case "convicted_final":
      return "Convicted (final) — official record";
    default: {
      const _exhaustive: never = flagType;
      throw new Error(`Unhandled flag_type: ${_exhaustive}`);
    }
  }
}

function flagTone(flagType: FlagType): Tone {
  switch (flagType) {
    case "outlier_expense":
    case "procurement_relationship":
    case "civil_proceeding":
    case "criminal_charge_pending":
    case "acquitted":
    case "convicted_appeal_pending":
    case "convicted_final":
      return "neutral";
    case "disclosure_inconsistency":
    case "cipc_directorship_match":
      return "review";
    default: {
      const _exhaustive: never = flagType;
      throw new Error(`Unhandled flag_type: ${_exhaustive}`);
    }
  }
}

const toneClass: Record<Tone, string> = {
  neutral: "",
  review: "bg-amber-100 text-amber-900 hover:bg-amber-200",
};

export function FlagBadge({ flagType }: { flagType: FlagType }) {
  const tone = flagTone(flagType);
  return (
    <Badge variant={tone === "review" ? "secondary" : "outline"} className={toneClass[tone]}>
      {flagLabel(flagType)}
    </Badge>
  );
}
