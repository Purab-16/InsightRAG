"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatPanel } from "@/components/chat/chat-panel";
import { ChunkInspector, type Inspected } from "@/components/chat/chunk-inspector";
import { ExportButton } from "@/components/export-button";
import { PrintButton } from "@/components/print-button";
import { api, ApiError, errorMessage } from "@/lib/api";
import { fileSlug, paperColor, paperLetter } from "@/lib/paper-colors";
import type { PaperDetail, Session } from "@/types/api";

interface Loaded {
  session: Session;
  papers: (PaperDetail | null)[]; // same order as session.paper_ids; null if it could not be loaded
}

export function ChatSessionView({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<{ message: string; notFound: boolean } | null>(null);
  const [inspected, setInspected] = useState<Inspected | null>(null);

  const load = useCallback(
    () =>
      api
        .getMessages(sessionId)
        .then(async ({ session }) => {
          const papers = await Promise.all(session.paper_ids.map((id) => api.getPaper(id).catch(() => null)));
          setData({ session, papers });
          setError(null);
        })
        .catch((e) => setError({ message: errorMessage(e), notFound: e instanceof ApiError && e.status === 404 })),
    [sessionId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const index = useMemo(
    () => new Map((data?.session.paper_ids ?? []).map((id, i) => [id, i] as const)),
    [data],
  );
  const accentFor = useCallback(
    (paperId: string) => {
      const i = index.get(paperId);
      return i === undefined || index.size < 2 ? undefined : paperColor(i);
    },
    [index],
  );
  const pdfUrlFor = useCallback(
    (paperId: string) => data?.papers.find((p) => p?.id === paperId)?.pdf_url ?? null,
    [data],
  );

  const back = (
    <Link href="/chats" className="inline-flex items-center gap-1.5 text-[14px] text-text-muted hover:text-text print:hidden">
      <ArrowLeft className="size-4" aria-hidden /> Chats
    </Link>
  );

  if (error && !data) {
    return (
      <div className="space-y-4">
        {back}
        <Card className="items-start gap-3 p-4">
          <p>{error.notFound ? "We couldn't find this chat." : error.message}</p>
          {!error.notFound && (
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Try again
            </Button>
          )}
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        {back}
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-[420px] w-full" />
      </div>
    );
  }

  const { session, papers } = data;
  const known = papers.filter((p): p is PaperDetail => p !== null);
  const title = session.title ?? (known.map((p) => p.title).join(" + ") || "Chat");
  const multi = session.paper_ids.length > 1;

  return (
    <div className="space-y-5">
      {back}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label-mono">
            Workspace / <span className="text-primary">RAG workspace</span>
          </p>
          <h1 className="mt-1 max-w-[75ch] text-[20px] leading-snug font-semibold sm:text-[24px]">{title}</h1>
        </div>
        <div className="flex gap-2">
          <PrintButton title={fileSlug(title, "chat")} />
          <ExportButton onExport={() => api.exportSession(session.id, `${fileSlug(title, "chat")}.md`)} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)_340px]">
        <aside aria-label="Papers in this chat" className="h-fit space-y-3 rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <h2 className="label-mono">Context corpus</h2>
            <span className="rounded-md bg-primary-soft px-2 py-0.5 font-mono text-[12px] text-primary">
              {session.paper_ids.length} active
            </span>
          </div>
          <ul className="space-y-2">
            {session.paper_ids.map((id, i) => {
              const paper = papers[i];
              return (
                <li key={id} className="flex items-start gap-2.5 rounded-lg border border-border bg-background p-2.5 text-[14px] leading-snug">
                  {multi && (
                    <span
                      aria-hidden
                      style={{ backgroundColor: paperColor(i) }}
                      className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-sm text-[11px] font-semibold text-primary-foreground"
                    >
                      {paperLetter(i)}
                    </span>
                  )}
                  {paper ? (
                    <Link href={`/paper/${id}`} className="line-clamp-3 text-text hover:underline">
                      {multi && <span className="sr-only">Paper {paperLetter(i)}: </span>}
                      {paper.title}
                    </Link>
                  ) : (
                    <span className="text-text-muted">Paper no longer in your library</span>
                  )}
                </li>
              );
            })}
          </ul>
        </aside>

        <ChatPanel
          paperIds={session.paper_ids}
          sessionId={session.id}
          pdfUrlFor={pdfUrlFor}
          accentFor={accentFor}
          onInspect={setInspected}
          className="h-[calc(100dvh-16rem)] min-h-[480px]"
          placeholder={multi ? "Ask across these papers…" : "Ask about this paper…"}
        />

        <div className="hidden lg:block">
          <ChunkInspector
            selection={inspected}
            pdfUrlFor={pdfUrlFor}
            paperFor={(paperId) => papers.find((p) => p?.id === paperId) ?? null}
            onPick={setInspected}
          />
        </div>
      </div>
    </div>
  );
}
