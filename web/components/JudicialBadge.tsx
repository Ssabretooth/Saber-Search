import { Badge } from "@/components/ui/badge";
import type { JudicialStatus } from "@/lib/types/flags";

function judicialLabel(status: JudicialStatus): string {
  switch (status) {
    case "charge_pending":
      return "Charge pending — presumption of innocence applies";
    case "acquitted":
      return "Acquitted";
    case "convicted_appeal_pending":
      return "Convicted, appeal pending";
    case "convicted_final":
      return "Convicted (final)";
    case "civil_matter":
      return "Civil matter";
    default: {
      const _exhaustive: never = status;
      throw new Error(`Unhandled judicial_status: ${_exhaustive}`);
    }
  }
}

export function JudicialBadge({ status }: { status: JudicialStatus }) {
  return <Badge variant="outline">{judicialLabel(status)}</Badge>;
}
