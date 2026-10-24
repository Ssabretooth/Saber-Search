import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ExternalLink, Info } from "lucide-react";
import type { SourceDocument } from "@/lib/types/database";

function isSafeHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

export function SourceCitation({ source }: { source?: SourceDocument }) {
  if (!source) return <span className="text-xs italic text-gray-400">No source attached</span>;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className="flex items-center text-blue-600 transition-colors hover:text-blue-800"
            aria-label="View source document"
          />
        }
      >
        <Info className="ml-1 h-4 w-4" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs border-gray-200 p-3 shadow-lg">
        <p className="mb-1 text-sm font-semibold text-gray-900">{source.title}</p>
        <p className="mb-3 text-xs text-gray-500">
          {source.publisher}
          {source.published_at ? ` • ${source.published_at}` : ""}
        </p>
        {source.licence_note && (
          <p className="mb-3 text-[10px] text-gray-400">{source.licence_note}</p>
        )}
        {isSafeHttpUrl(source.url) ? (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center text-xs font-medium text-blue-600 hover:underline"
          >
            View source document <ExternalLink className="ml-1 h-3 w-3" />
          </a>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}
