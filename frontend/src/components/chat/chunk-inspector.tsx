"use client";

import { Copy, ExternalLink, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sourceLabel } from "@/components/chat/source-chip";
import { toBibtex } from "@/lib/bibtex";
import type { PaperDetail, Source } from "@/types/api";

export interface Inspected {
  source: Source;
  /** Other passages cited in the same answer. */
  others: Source[];
}

interface Props {
  selection: Inspected | null;
  pdfUrlFor: (paperId: string) => string | null;
  /** Paper details for the BibTeX button; null when the paper is no longer in the library. */
  paperFor: (paperId: string) => PaperDetail | null;
  onPick: (selection: Inspected) => void;
}

async function copyBibtex(paper: PaperDetail) {
  try {
    await navigator.clipboard.writeText(toBibtex(paper));
    toast.success("BibTeX copied.");
  } catch {
    toast.error("Couldn't copy. Your browser blocked clipboard access.");
  }
}

/** Right column of the workspace: shows the passage behind a citation chip. */
export function ChunkInspector({ selection, pdfUrlFor, paperFor, onPick }: Props) {
  const source = selection?.source ?? null;
  const pdf = source ? pdfUrlFor(source.paper_id) : null;
  const paper = source ? paperFor(source.paper_id) : null;

  return (
    <aside aria-label="Chunk inspector" className="flex min-h-[420px] flex-col rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold tracking-wide uppercase">
          <ScanSearch className="size-4 text-primary" aria-hidden /> Chunk inspector
        </h2>
        {source && (
          <span className="rounded-md bg-success/10 px-2 py-0.5 font-mono text-[12px] text-success">
            Passage [{source.n}]
          </span>
        )}
      </div>

      {!source ? (
        <p className="p-4 text-[14px] text-text-muted">
          Click a citation chip in an answer to see the exact passage it came from.
        </p>
      ) : (
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="rounded-lg border border-border bg-background p-3">
            <p className="label-mono">Source article</p>
            <p className="mt-1 text-[15px] leading-snug font-medium">{source.paper_title}</p>
            <p className="mt-1 font-mono text-[12px] text-text-muted">{sourceLabel(source)}</p>
          </div>

          <div className="rounded-lg border border-border bg-background p-3">
            <div className="flex items-center justify-between">
              <span className="label-mono">Cosine similarity</span>
              <span className="font-mono text-[15px] text-success">{source.similarity.toFixed(3)}</span>
            </div>
            <div
              role="progressbar"
              aria-label="Cosine similarity"
              aria-valuenow={Math.round(source.similarity * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-border"
            >
              <div
                className="h-full rounded-full bg-success"
                style={{ width: `${Math.max(0, Math.min(100, source.similarity * 100))}%` }}
              />
            </div>
          </div>

          <div>
            <p className="label-mono mb-2">Extracted passage</p>
            <blockquote className="rounded-lg border border-border bg-background p-3 font-mono text-[13px] leading-relaxed text-text">
              &ldquo;{source.snippet}&rdquo;
            </blockquote>
          </div>

          {selection && selection.others.length > 0 && (
            <div>
              <p className="label-mono mb-2">Other candidate passages</p>
              <ul className="space-y-1">
                {selection.others.map((o) => (
                  <li key={`${o.n}-${o.chunk_id}`}>
                    <button
                      type="button"
                      onClick={() => onPick({ source: o, others: [source, ...selection.others.filter((x) => x !== o)] })}
                      className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-2 text-left text-[14px] hover:bg-primary-soft/60 focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <span className="truncate">
                        <span className="font-mono text-primary">[{o.n}]</span> {o.paper_title}
                        {o.page ? ` · p.${o.page}` : ""}
                      </span>
                      <span className="font-mono text-[12px] text-text-muted">{o.similarity.toFixed(3)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {source && (
        <div className="space-y-2 border-t border-border p-3">
          {pdf && (
            <Button asChild className="w-full">
              <a href={source.page ? `${pdf}#page=${source.page}` : pdf} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden /> Jump to PDF source{source.page ? ` (page ${source.page})` : ""}
              </a>
            </Button>
          )}
          {paper && (
            <Button variant="outline" className="w-full" onClick={() => void copyBibtex(paper)}>
              <Copy aria-hidden /> Copy BibTeX citation
            </Button>
          )}
        </div>
      )}
    </aside>
  );
}
