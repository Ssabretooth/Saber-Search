import { SourceCitation } from "@/components/SourceCitation";
import type { SourceDocument } from "@/lib/types/database";

type Row = {
  id: string;
  category: string;
  description: string | null;
  counterparty: string | null;
  value_zar: number | null;
  period_start: string | null;
  period_end: string | null;
  source?: SourceDocument;
};

export function DisclosuresTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">No records.</p>;
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b">
          <th className="p-2">Category</th>
          <th className="p-2">Description</th>
          <th className="p-2">Counterparty</th>
          <th className="p-2">Value (ZAR)</th>
          <th className="p-2">Source</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b">
            <td className="p-2">{r.category}</td>
            <td className="p-2">{r.description ?? "—"}</td>
            <td className="p-2">{r.counterparty ?? "—"}</td>
            <td className="p-2">
              {r.value_zar === null ? "—" : Number(r.value_zar).toLocaleString("en-ZA")}
            </td>
            <td className="p-2"><SourceCitation source={r.source} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
