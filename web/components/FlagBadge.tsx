import { Badge } from "@/components/ui/badge";
import type { FlagType } from "@/lib/types/flags";

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

export function FlagBadge({ flagType }: { flagType: FlagType }) {
  return <Badge variant="outline">{flagLabel(flagType)}</Badge>;
}
