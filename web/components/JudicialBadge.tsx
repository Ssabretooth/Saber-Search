import { Badge } from "@/components/ui/badge";
import type { JudicialStatus } from "@/lib/types/flags";

function judicialLabel(status: JudicialStatus): string {
  switch (status) {
    case "charge_pending":
      return "Charge pending — presumption of innocence applies";
    case "acquitted":
      return "Acquitted — official record";
    case "convicted_appeal_pending":
      return "Convicted, appeal pending — official record";
    case "convicted_final":
      return "Convicted (final) — official record";
    case "civil_matter":
      return "Civil matter — official record";
    default: {
      const _exhaustive: never = status;
      throw new Error(`Unhandled judicial_status: ${_exhaustive}`);
    }
  }
}

export function JudicialBadge({ status }: { status: JudicialStatus }) {
  return <Badge variant="outline">{judicialLabel(status)}</Badge>;
}
