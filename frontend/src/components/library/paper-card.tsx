"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileText, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/library/status-badge";
import { api, errorMessage } from "@/lib/api";
import { formatAuthors } from "@/lib/format";
import type { PaperSummary } from "@/types/api";

export interface CardSelection {
  selected: boolean;
  /** True when the 3-paper limit is reached and this card is not selected. */
  disabled: boolean;
  onToggle: (selected: boolean) => void;
}

interface Props {
  paper: PaperSummary;
  onChanged: () => void;
  /** Set in selection mode. Only ready papers can be selected. */
  selection?: CardSelection;
}

export function PaperCard({ paper, onChanged, selection }: Props) {
  const [reason, setReason] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const failed = paper.status === "failed";
  const ready = paper.status === "ready";

  // The list does not carry the failure reason, so fetch it for failed cards only.
  useEffect(() => {
    if (!failed) return;
    let cancelled = false;
    api
      .getPaper(paper.id)
      .then((d) => !cancelled && setReason(d.error))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [failed, paper.id]);

  async function retry() {
    setRetrying(true);
    try {
      await api.retryPaper(paper.id);
      onChanged();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setRetrying(false);
    }
  }

  const source = paper.source === "arxiv" && paper.arxiv_id ? `arXiv:${paper.arxiv_id}` : "Uploaded PDF";

  const title = (
    <h3 className="line-clamp-2 text-[16px] font-semibold leading-snug text-text">{paper.title}</h3>
  );

  return (
    <Card className={cn("gap-3 p-4 shadow-sm", selection?.selected && "border-primary bg-primary-soft")}>
      <div className="flex items-start gap-2">
        {selection && (
          <Checkbox
            checked={selection.selected}
            disabled={!ready || selection.disabled}
            onCheckedChange={(v) => selection.onToggle(v === true)}
            aria-label={`Select ${paper.title}`}
            className="mt-1"
          />
        )}
        <FileText className="mt-1 size-4 shrink-0 text-text-muted" aria-hidden />
        {ready ? (
          <Link
            href={`/paper/${paper.id}`}
            className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-ring"
          >
            {title}
          </Link>
        ) : (
          title
        )}
      </div>

      <p className="text-[13px] text-text-muted">
        {formatAuthors(paper.authors)} ·{" "}
        <span className={paper.source === "arxiv" ? "font-mono" : undefined}>{source}</span>
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-2">
        <StatusBadge status={paper.status} step={paper.status_step} />
        {paper.status === "processing" && (
          <span className="text-[13px] text-text-muted">Usually under a minute</span>
        )}
      </div>

      {failed && (
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] text-text">
            Couldn&apos;t process this paper{reason ? `: ${reason}` : "."}
          </p>
          <Button variant="outline" size="sm" onClick={retry} disabled={retrying} className="shrink-0">
            <RotateCw className={retrying ? "animate-spin" : ""} aria-hidden /> Retry
          </Button>
        </div>
      )}
    </Card>
  );
}
