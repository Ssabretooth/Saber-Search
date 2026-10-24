'use client';

import { ReactNode } from 'react';

export function DataCard({
  icon: Icon,
  title,
  value,
  subtitle
}: {
  icon: any;
  title: string;
  value: string | number;
  subtitle?: string
}) {
  return (
    <div className="bg-white border rounded-lg p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-teal-50 rounded-lg flex items-center justify-center flex-shrink-0">
          <Icon className="text-teal-600" size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-600">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-2">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-4xl font-bold tracking-tight text-slate-900">{title}</h1>
      {subtitle && <p className="text-lg text-slate-600 mt-2">{subtitle}</p>}
    </div>
  );
}

export function DataTable({
  headers,
  rows
}: {
  headers: string[];
  rows: (ReactNode | string)[][]
}) {
  return (
    <div className="overflow-x-auto bg-white border rounded-lg">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-slate-50">
            {headers.map((h, i) => (
              <th key={i} className="text-left p-4 font-semibold text-sm text-slate-900">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b hover:bg-slate-50 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="p-4 text-sm text-slate-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Badge({ type }: { type: 'status' | 'category' | 'flag' }) {
  const styles = {
    status: 'bg-blue-100 text-blue-700',
    category: 'bg-teal-100 text-teal-700',
    flag: 'bg-amber-100 text-amber-700',
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles[type]}`} />
  );
}
