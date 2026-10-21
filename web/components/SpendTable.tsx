import { SourceCitation } from "@/components/SourceCitation";

type Row = {
  id: string;
  spend_type: string;
  amount_zar: number;
  period_start: string;
  period_end: string;
  department: string | null;
  source_document_id: string;
};

export function SpendTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">No records.</p>;
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b">
          <th className="p-2">Type</th>
          <th className="p-2">Amount (ZAR)</th>
          <th className="p-2">Period</th>
          <th className="p-2">Department</th>
          <th className="p-2">Source</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b">
            <td className="p-2">{r.spend_type}</td>
            <td className="p-2">{Number(r.amount_zar).toLocaleString("en-ZA")}</td>
            <td className="p-2">{r.period_start} – {r.period_end}</td>
            <td className="p-2">{r.department ?? "—"}</td>
            <td className="p-2"><SourceCitation documentId={r.source_document_id} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
