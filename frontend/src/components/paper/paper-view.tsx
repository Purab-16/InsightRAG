"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatPanel } from "@/components/chat/chat-panel";
import { StatusBadge } from "@/components/library/status-badge";
import { InsightsPanel } from "@/components/paper/insights-panel";
import { ExportButton } from "@/components/export-button";
import { PrintButton } from "@/components/print-button";
import { api, ApiError, errorMessage } from "@/lib/api";
import { fileSlug } from "@/lib/paper-colors";
import type { PaperDetail } from "@/types/api";

// React Flow and dagre are heavy and only needed on the graph tab, so load them on demand.
const CitationGraph = dynamic(() => import("@/components/graph/citation-graph").then((m) => m.CitationGraph), {
  ssr: false,
  loading: () => <Skeleton className="h-[480px] w-full" />,
});

const POLL_MS = 4000;

export function PaperView({ id }: { id: string }) {
  const [paper, setPaper] = useState<PaperDetail | null>(null);
  const [error, setError] = useState<{ message: string; notFound: boolean } | null>(null);

  const load = useCallback(
    () =>
      api
        .getPaper(id)
        .then((p) => {
          setPaper(p);
          setError(null);
        })
        .catch((e) => setError({ message: errorMessage(e), notFound: e instanceof ApiError && e.status === 404 })),
    [id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const processing = paper?.status === "processing";
  useEffect(() => {
    if (!processing) return;
    const tick = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [processing, load]);

  const pdfUrlFor = useCallback(
    (paperId: string) => (paper && paperId === paper.id ? paper.pdf_url : null),
    [paper],
  );

  const back = (
    <Link href="/" className="inline-flex items-center gap-1.5 text-[14px] text-text-muted hover:text-text print:hidden">
      <ArrowLeft className="size-4" aria-hidden /> Library
    </Link>
  );

  if (error && !paper) {
    return (
      <div className="space-y-4">
        {back}
        <Card className="items-start gap-3 p-4">
          <p>{error.notFound ? "We couldn't find this paper in your library." : error.message}</p>
          {!error.notFound && (
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Try again
            </Button>
          )}
        </Card>
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="space-y-4">
        {back}
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const ready = paper.status === "ready";
  const year = paper.published?.slice(0, 4);

  return (
    <div className="space-y-5">
      {back}

      <header className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="label-mono">
              Workspace / <span className="text-primary">Paper</span>
            </p>
            <h1 className="mt-1 max-w-[75ch] text-[20px] leading-snug font-semibold sm:text-[24px]">{paper.title}</h1>
          </div>
          {ready && (
            <div className="flex gap-2">
              <PrintButton title={fileSlug(paper.title, "paper")} />
              <ExportButton onExport={() => api.exportPaper(paper.id, `${fileSlug(paper.title, "paper")}.md`)} />
            </div>
          )}
        </div>
        <p className="text-[14px] text-text-muted">
          {paper.authors.join(", ") || "Unknown authors"}
          {year ? ` · ${year}` : ""}
          {paper.arxiv_id && (
            <>
              {" · "}
              <a
                href={`https://arxiv.org/abs/${paper.arxiv_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono text-primary hover:underline"
              >
                arXiv:{paper.arxiv_id} <ExternalLink className="size-3" aria-hidden />
              </a>
            </>
          )}
        </p>
        {!ready && <StatusBadge status={paper.status} step={paper.status_step} />}
      </header>

      {ready && (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Published", value: year ?? "--" },
            { label: "Chunks indexed", value: paper.chunk_count != null ? String(paper.chunk_count) : "--" },
            { label: "Field", value: paper.insights?.field ?? "--" },
            { label: "Source", value: paper.source === "arxiv" ? "arXiv" : "Uploaded PDF" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-surface px-4 py-3">
              <dt className="label-mono">{s.label}</dt>
              <dd className="mt-1 truncate text-[16px] font-semibold">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {paper.status === "processing" && (
        <Card className="gap-2 p-4">
          <p className="text-text">Processing… usually under a minute. This page updates by itself.</p>
          <Skeleton className="h-24 w-full" />
        </Card>
      )}

      {paper.status === "failed" && (
        <Card className="items-start gap-3 p-4">
          <p className="text-text">Couldn&apos;t process this paper{paper.error ? `: ${paper.error}` : "."}</p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/">Back to library to retry</Link>
          </Button>
        </Card>
      )}

      {ready && (
        <Tabs defaultValue="insights">
          <TabsList className="print:hidden">
            <TabsTrigger value="insights">Insights</TabsTrigger>
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="graph">Citation graph</TabsTrigger>
          </TabsList>

          <TabsContent value="insights" className="mt-4">
            {paper.insights ? (
              <InsightsPanel insights={paper.insights} />
            ) : (
              <Card className="p-4">
                <p className="text-text">Insights couldn&apos;t be generated for this paper. Chat still works.</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="chat" className="mt-4">
            <ChatPanel paperIds={[paper.id]} pdfUrlFor={pdfUrlFor} />
          </TabsContent>

          <TabsContent value="graph" className="mt-4">
            <CitationGraph paperId={paper.id} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
