"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ExternalLink, Loader2, MessageSquare, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/library/status-badge";
import type { CardSelection } from "@/components/library/paper-card";
import { api, errorMessage } from "@/lib/api";
import { formatAuthors } from "@/lib/format";
import { chatIdFor } from "@/lib/open-chat";
import { cn } from "@/lib/utils";
import type { PaperSummary } from "@/types/api";

interface RowProps {
  paper: PaperSummary;
  onChanged: () => void;
  selection?: CardSelection;
}

function PaperRow({ paper, onChanged, selection }: RowProps) {
  const router = useRouter();
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ready = paper.status === "ready";
  const failed = paper.status === "failed";

  // The list does not carry the failure reason, so fetch it for failed rows only.
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
    setBusy(true);
    try {
      await api.retryPaper(paper.id);
      onChanged();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function chat() {
    setBusy(true);
    try {
      router.push(`/chat/${await chatIdFor([paper.id])}`);
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(false);
    }
  }

  const source = paper.source === "arxiv" && paper.arxiv_id ? `arXiv:${paper.arxiv_id}` : "Uploaded PDF";
  const title = <span className="line-clamp-2 text-[15px] leading-snug font-medium text-text">{paper.title}</span>;

  return (
    <TableRow className={cn(selection?.selected && "bg-primary-soft/60")}>
      {selection && (
        <TableCell className="w-10">
          <Checkbox
            checked={selection.selected}
            disabled={!ready || selection.disabled}
            onCheckedChange={(v) => selection.onToggle(v === true)}
            aria-label={`Select ${paper.title}`}
          />
        </TableCell>
      )}
      <TableCell className="max-w-[420px] whitespace-normal">
        {ready ? (
          <Link href={`/paper/${paper.id}`} className="hover:underline focus-visible:outline-2 focus-visible:outline-ring">
            {title}
          </Link>
        ) : (
          title
        )}
        <p className="mt-0.5 truncate text-[13px] text-text-muted">{formatAuthors(paper.authors)}</p>
        {failed && (
          <p className="mt-1 text-[13px] text-danger">Couldn&apos;t process this paper{reason ? `: ${reason}` : "."}</p>
        )}
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <span className="rounded-md bg-background px-2 py-1 font-mono text-[12px] text-text-muted">{source}</span>
      </TableCell>
      <TableCell className="hidden font-mono text-[13px] text-text-muted sm:table-cell">
        {paper.published?.slice(0, 4) ?? "--"}
      </TableCell>
      <TableCell>
        <StatusBadge status={paper.status} step={paper.status_step} />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          {ready && (
            <>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Chat with ${paper.title}`}
                disabled={busy}
                onClick={() => void chat()}
              >
                {busy ? <Loader2 className="animate-spin" aria-hidden /> : <MessageSquare aria-hidden />}
              </Button>
              <Button variant="ghost" size="icon" asChild aria-label={`Open ${paper.title}`}>
                <Link href={`/paper/${paper.id}`}>
                  <ExternalLink aria-hidden />
                </Link>
              </Button>
            </>
          )}
          {failed && (
            <Button variant="outline" size="sm" onClick={() => void retry()} disabled={busy}>
              <RotateCw className={busy ? "animate-spin" : ""} aria-hidden /> Retry
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

interface Props {
  papers: PaperSummary[];
  onChanged: () => void;
  selectionFor?: (paper: PaperSummary) => CardSelection;
}

export function PaperTable({ papers, onChanged, selectionFor }: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {selectionFor && <TableHead className="w-10" />}
            <TableHead className="label-mono">Paper title &amp; authors</TableHead>
            <TableHead className="label-mono hidden md:table-cell">Source / ID</TableHead>
            <TableHead className="label-mono hidden sm:table-cell">Year</TableHead>
            <TableHead className="label-mono">Status</TableHead>
            <TableHead className="label-mono text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {papers.map((p) => (
            <PaperRow key={p.id} paper={p} onChanged={onChanged} selection={selectionFor?.(p)} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
