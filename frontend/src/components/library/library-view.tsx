"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BookOpen, GitCompare, LayoutGrid, List, Loader2, MessageSquare, Plus, SquareCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AddByIdInput } from "@/components/library/add-by-id-input";
import { ArxivSearch } from "@/components/library/arxiv-search";
import { LibraryToolbar, applyView, DEFAULT_VIEW, type ViewState } from "@/components/library/library-toolbar";
import { OnboardingHint } from "@/components/library/onboarding-hint";
import { PaperCard, type CardSelection } from "@/components/library/paper-card";
import { LibraryStats } from "@/components/library/library-stats";
import { PaperTable } from "@/components/library/paper-table";
import { ProcessingQueue } from "@/components/library/processing-queue";
import { UploadDropzone } from "@/components/library/upload-dropzone";
import { LimitBanner, UsageMeter } from "@/components/usage/usage-meter";
import { usePapers } from "@/hooks/use-papers";
import { useUsage } from "@/hooks/use-usage";
import { api, errorMessage } from "@/lib/api";
import { chatIdFor } from "@/lib/open-chat";
import { cn } from "@/lib/utils";
import type { PaperSummary } from "@/types/api";

const MAX_SELECT = 3;

const EXAMPLES = [
  { id: "1706.03762", title: "Attention Is All You Need", note: "The Transformer" },
  { id: "2106.09685", title: "LoRA: Low-Rank Adaptation of Large Language Models", note: "Efficient fine-tuning" },
  { id: "1512.03385", title: "Deep Residual Learning for Image Recognition", note: "ResNet" },
];

export function LibraryView() {
  const { papers, error, refresh } = usePapers();
  const [tryingId, setTryingId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [opening, setOpening] = useState(false);
  const router = useRouter();
  const readyCount = papers?.filter((p) => p.status === "ready").length ?? 0;
  const usage = useUsage();
  const [view, setView] = useState<ViewState>(DEFAULT_VIEW);
  const [layout, setLayout] = useState<"list" | "grid">("list");
  const visible = useMemo(() => (papers ? applyView(papers, view) : []), [papers, view]);

  const selectionFor = selecting
    ? (p: PaperSummary): CardSelection => ({
        selected: selected.includes(p.id),
        disabled: !selected.includes(p.id) && selected.length >= MAX_SELECT,
        onToggle: (on) => setSelected((prev) => (on ? [...prev, p.id] : prev.filter((x) => x !== p.id))),
      })
    : undefined;

  function stopSelecting() {
    setSelecting(false);
    setSelected([]);
  }

  async function chatWith() {
    setOpening(true);
    try {
      router.push(`/chat/${await chatIdFor(selected)}`);
    } catch (e) {
      toast.error(errorMessage(e));
      setOpening(false);
    }
  }

  function compareSelected() {
    router.push(`/compare?ids=${selected.join(",")}`);
  }

  /** Resolves true if the paper was accepted, so callers only mark it as added on success. */
  async function addArxiv(arxivId: string): Promise<boolean> {
    try {
      const res = await api.addArxiv(arxivId);
      toast.success(res.status === "ready" ? "Already in your library." : "Added. Processing usually takes under a minute.");
      await refresh();
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    }
  }

  async function upload(file: File) {
    try {
      await api.uploadPdf(file);
      toast.success("Uploaded. Processing usually takes under a minute.");
      await refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function tryExample(id: string) {
    setTryingId(id);
    await addArxiv(id);
    setTryingId(null);
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="label-mono">
          Workspace / <span className="text-primary">Paper library</span>
        </p>
        <h1 className="mt-1 text-[32px] leading-tight font-bold tracking-tight">Research Corpus Index</h1>
        <p className="mt-1 text-text-muted">Add a paper, then chat with it and get insights with sources.</p>
      </div>

      <LibraryStats papers={papers} usage={usage} />

      {papers && <ProcessingQueue papers={papers} />}

      <OnboardingHint />

      <section id="add-paper" aria-label="Add a paper" className="scroll-mt-24 space-y-4 rounded-xl border border-border bg-surface p-5">
        <LimitBanner usage={usage} kind="papers" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex-1">
            <ArxivSearch onAdd={addArxiv} />
          </div>
          <UploadDropzone onUpload={upload} />
        </div>
        <AddByIdInput onAdd={addArxiv} />
        <UsageMeter usage={usage} kind="papers" />
      </section>

      <section aria-label="My papers" className={selecting ? "pb-20" : undefined}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="label-mono">My papers{papers ? ` (${papers.length})` : ""}</h2>
          <div className="flex items-center gap-2">
            <div role="group" aria-label="Layout" className="flex rounded-lg border border-border p-0.5">
              {(
                [
                  { value: "list", label: "List view", icon: List },
                  { value: "grid", label: "Grid view", icon: LayoutGrid },
                ] as const
              ).map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  variant="ghost"
                  size="icon"
                  aria-label={label}
                  aria-pressed={layout === value}
                  onClick={() => setLayout(value)}
                  className={cn("size-8", layout === value && "bg-primary-soft text-primary")}
                >
                  <Icon aria-hidden />
                </Button>
              ))}
            </div>
            {readyCount >= 1 && (
              <Button variant="outline" size="sm" onClick={() => (selecting ? stopSelecting() : setSelecting(true))}>
                {selecting ? (
                  <>
                    <X aria-hidden /> Cancel
                  </>
                ) : (
                  <>
                    <SquareCheck aria-hidden /> Select
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {error && !papers && (
          <Card className="items-start gap-3 p-4">
            <p className="text-[14px] text-text">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              Try again
            </Button>
          </Card>
        )}

        {!papers && !error && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-36 w-full" />
            ))}
          </div>
        )}

        {papers && papers.length === 0 && (
          <Card className="items-center gap-4 p-8 text-center">
            <BookOpen className="size-8 text-primary" aria-hidden />
            <div>
              <h3 className="text-[20px] font-semibold">Start with a paper</h3>
              <p className="text-text-muted">Your library is empty. Search arXiv or try one of these papers.</p>
            </div>
            <ul className="grid w-full gap-3 text-left sm:grid-cols-3">
              {EXAMPLES.map((ex) => (
                <li key={ex.id}>
                  <Card className="h-full justify-between gap-3 p-4 shadow-sm">
                    <div>
                      <h4 className="text-[15px] font-semibold leading-snug">{ex.title}</h4>
                      <p className="text-[13px] text-text-muted">
                        {ex.note} · <span className="font-mono">{ex.id}</span>
                      </p>
                    </div>
                    <Button size="sm" variant="outline" disabled={tryingId !== null} onClick={() => void tryExample(ex.id)}>
                      {tryingId === ex.id ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
                      Try this
                    </Button>
                  </Card>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {papers && papers.length >= 2 && (
          <LibraryToolbar view={view} onChange={setView} shown={visible.length} total={papers.length} />
        )}

        {papers && papers.length > 0 && visible.length === 0 && (
          <Card className="items-start gap-3 p-4">
            <p className="text-[14px] text-text">No papers match your filter.</p>
            <Button variant="outline" size="sm" onClick={() => setView(DEFAULT_VIEW)}>
              Clear filter
            </Button>
          </Card>
        )}

        {papers && visible.length > 0 && layout === "list" && (
          <PaperTable papers={visible} onChanged={() => void refresh()} selectionFor={selectionFor} />
        )}

        {papers && visible.length > 0 && layout === "grid" && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((p) => (
              <li key={p.id} className="flex">
                <div className="flex-1">
                  <PaperCard paper={p} onChanged={() => void refresh()} selection={selectionFor?.(p)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selecting && (
        <div
          role="region"
          aria-label="Selected papers"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface py-3"
        >
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 sm:px-6">
            <p className="text-[14px] text-text" aria-live="polite">
              {selected.length} selected{selected.length >= MAX_SELECT ? " (max 3)" : ""}
            </p>
            <div className="flex gap-2">
              <Button size="sm" disabled={selected.length < 1 || opening} onClick={() => void chatWith()}>
                {opening ? <Loader2 className="animate-spin" aria-hidden /> : <MessageSquare aria-hidden />}
                Chat
              </Button>
              <Button size="sm" variant="outline" disabled={selected.length < 2} onClick={compareSelected}>
                <GitCompare aria-hidden /> Compare (2–3)
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
