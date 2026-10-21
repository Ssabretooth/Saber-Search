"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Source = {
  id: string;
  publisher: string;
  title: string;
  url: string;
  published_at: string | null;
};

export function SourceCitation({ documentId }: { documentId: string }) {
  const [source, setSource] = useState<Source | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    supabase
      .from("v_sources_public")
      .select("id, publisher, title, url, published_at")
      .eq("id", documentId)
      .maybeSingle<Source>()
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data) setFailed(true);
        else setSource(data);
      });
    return () => {
      active = false;
    };
  }, [documentId]);

  if (failed) return <span className="text-xs text-red-700">Source unavailable</span>;
  if (!source) return <span className="text-xs text-slate-400">Loading source…</span>;

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="cursor-help underline decoration-dotted text-xs" />}>
        Source
      </TooltipTrigger>
      <TooltipContent>
        <span className="block">
          {source.publisher} — {source.title}
          {source.published_at ? ` (${source.published_at})` : ""}
        </span>
        <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline">
          View source
        </a>
      </TooltipContent>
    </Tooltip>
  );
}
