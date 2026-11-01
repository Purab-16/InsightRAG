"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Source } from "@/types/api";

export function sourceLabel(s: Source): string {
  return [s.section, s.page ? `p.${s.page}` : null].filter(Boolean).join(" · ") || s.paper_title;
}

interface Props {
  source: Source;
  onOpen: (source: Source) => void;
  /** Optional colour (CSS value) used as a left border to show which paper the source is from. */
  accent?: string;
}

export function SourceChip({ source, onOpen, accent }: Props) {
  const where = [source.section, source.page ? `page ${source.page}` : null].filter(Boolean).join(", ");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onOpen(source)}
          aria-label={`Source ${source.n}${where ? `: ${where}` : ""}`}
          style={accent ? { borderLeftColor: accent } : undefined}
          className={cn(
            "mx-0.5 inline-flex min-w-6 items-center justify-center rounded-full bg-primary-soft px-1.5 align-baseline",
            "text-[13px] font-medium text-primary hover:bg-primary hover:text-primary-foreground",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            accent && "rounded-md border-l-4",
          )}
        >
          {source.n}
        </button>
      </TooltipTrigger>
      <TooltipContent>{sourceLabel(source)}</TooltipContent>
    </Tooltip>
  );
}
