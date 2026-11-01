"use client";

import { ExternalLink } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { sourceLabel } from "@/components/chat/source-chip";
import type { Source } from "@/types/api";

interface Props {
  source: Source | null;
  onClose: () => void;
  /** PDF link for a paper, or null when there is none (uploads). */
  pdfUrlFor: (paperId: string) => string | null;
}

/** Right side panel on desktop, bottom sheet on mobile. */
export function SourceDrawer({ source, onClose, pdfUrlFor }: Props) {
  const desktop = useMediaQuery("(min-width: 768px)");
  const pdf = source ? pdfUrlFor(source.paper_id) : null;

  return (
    <Sheet open={source !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side={desktop ? "right" : "bottom"} className="max-h-[80dvh] overflow-y-auto sm:max-w-sm">
        {source && (
          <>
            <SheetHeader>
              <SheetTitle>Source [{source.n}]</SheetTitle>
              <SheetDescription className="text-text">{source.paper_title}</SheetDescription>
            </SheetHeader>
            <div className="space-y-3 px-4 pb-6">
              <p className="text-[13px] text-text-muted">{sourceLabel(source)}</p>
              <blockquote className="border-l-2 border-border pl-3 text-[15px] leading-relaxed text-text">
                &ldquo;{source.snippet}&rdquo;
              </blockquote>
              {pdf && (
                <a
                  href={source.page ? `${pdf}#page=${source.page}` : pdf}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[14px] font-medium text-primary hover:underline"
                >
                  Open PDF{source.page ? ` at p.${source.page}` : ""} <ExternalLink className="size-3.5" aria-hidden />
                </a>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
