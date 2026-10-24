import { JudicialBadge } from "@/components/JudicialBadge";
import { SourceCitation } from "@/components/SourceCitation";
import type { JudicialPublic, SourceDocument } from "@/lib/types/database";

type Row = JudicialPublic & { source?: SourceDocument };

export function JudicialTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">No records.</p>;
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b">
          <th className="p-2">Status</th>
          <th className="p-2">Case</th>
          <th className="p-2">Court</th>
          <th className="p-2">Summary</th>
          <th className="p-2">As of</th>
          <th className="p-2">Source</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b">
            <td className="p-2"><JudicialBadge status={r.status} /></td>
            <td className="p-2">{r.case_number ?? "—"}</td>
            <td className="p-2">{r.court ?? "—"}</td>
            <td className="p-2">{r.summary_neutral ?? "—"}</td>
            <td className="p-2">{r.status_as_of}</td>
            <td className="p-2"><SourceCitation source={r.source} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
