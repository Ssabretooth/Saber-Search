import { Badge } from "@/components/ui/badge";

export function PartyBadge({ party }: { party: string | null }) {
  if (!party) return <Badge variant="outline">Unknown</Badge>;

  const p = party.toUpperCase();
  let colorClass = "bg-gray-100 text-gray-800 border-gray-200"; // default

  if (p.includes("ANC")) colorClass = "bg-green-100 text-green-800 border-green-200";
  else if (p.includes("DA")) colorClass = "bg-blue-100 text-blue-800 border-blue-200";
  else if (p.includes("EFF")) colorClass = "bg-red-100 text-red-800 border-red-200";
  else if (p.includes("MK")) colorClass = "bg-purple-100 text-purple-800 border-purple-200";
  else if (p.includes("IFP")) colorClass = "bg-orange-100 text-orange-800 border-orange-200";
  else if (p.includes("FF+")) colorClass = "bg-teal-100 text-teal-800 border-teal-200";
  else if (p.includes("ACDP")) colorClass = "bg-indigo-100 text-indigo-800 border-indigo-200";

  return (
    <Badge variant="outline" className={`text-[10px] font-semibold px-1.5 py-0.5 h-5 ${colorClass}`}>
      {p}
    </Badge>
  );
}
