"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, GitCompare, Highlighter, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CompareTable } from "@/components/compare/compare-table";
import { PaperSelector } from "@/components/library/paper-selector";
import { usePapers } from "@/hooks/use-papers";
import { api, errorMessage } from "@/lib/api";
import { compareToMarkdown } from "@/lib/compare-md";
import { saveText } from "@/lib/download";
import { chatIdFor } from "@/lib/open-chat";
import type { CompareResponse } from "@/types/api";

export function CompareView() {
  const params = useSearchParams();
  const router = useRouter();
  const { papers } = usePapers();
  const [picking, setPicking] = useState(false);
  const [opening, setOpening] = useState(false);
  const [diff, setDiff] = useState(false);
  const [result, setResult] = useState<{ key: string; data?: CompareResponse; error?: string } | null>(null);

  const ids = (params.get("ids") ?? "").split(",").filter(Boolean);
  const key = ids.join(",");
  const valid = ids.length >= 2 && ids.length <= 3;

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    api
      .compare(key.split(","))
      .then((data) => !cancelled && setResult({ key, data }))
      .catch((e) => !cancelled && setResult({ key, error: errorMessage(e) }));
    return () => {
      cancelled = true;
    };
  }, [key, valid]);

  // A result for an older selection does not count: show the skeleton until the new one arrives.
  const current = valid && result?.key === key ? result : null;

  async function chatAbout() {
    setOpening(true);
    try {
      router.push(`/chat/${await chatIdFor(ids)}`);
    } catch (e) {
      toast.error(errorMessage(e));
      setOpening(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label-mono">
            Workspace / <span className="text-primary">Compare insights</span>
          </p>
          <h1 className="mt-1 text-[32px] leading-tight font-bold tracking-tight">Structured Paper Comparison</h1>
          <p className="mt-1 text-text-muted">Built from each paper&apos;s extracted insights. Compare up to 3 papers.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setPicking(true)}>
            <GitCompare aria-hidden /> {valid ? "Switch papers" : "Select papers (2–3)"}
          </Button>
          {current?.data && (
            <>
              <Button variant="outline" aria-pressed={diff} onClick={() => setDiff((v) => !v)}>
                <Highlighter aria-hidden /> Diff highlights{diff ? ": on" : ""}
              </Button>
              <Button
                variant="outline"
                onClick={() => saveText("paper-comparison.md", compareToMarkdown(current.data!))}
              >
                <Download aria-hidden /> Export matrix
              </Button>
            </>
          )}
          {current?.data && (
            <Button onClick={() => void chatAbout()} disabled={opening}>
              {opening ? <Loader2 className="animate-spin" aria-hidden /> : <MessageSquare aria-hidden />}
              Chat about these
            </Button>
          )}
        </div>
      </div>

      {!valid && (
        <Card className="items-center gap-3 p-8 text-center">
          <GitCompare className="size-8 text-primary" aria-hidden />
          <div>
            <h2 className="text-[20px] font-semibold">Compare 2 or 3 papers</h2>
            <p className="text-text-muted">See problem, method, datasets and results side by side.</p>
          </div>
          <Button onClick={() => setPicking(true)}>Select papers</Button>
        </Card>
      )}

      {valid && !current && <Skeleton className="h-96 w-full" />}

      {current?.error && (
        <Card className="items-start gap-3 p-4">
          <p>{current.error}</p>
          <Button variant="outline" size="sm" onClick={() => setPicking(true)}>
            Pick different papers
          </Button>
        </Card>
      )}

      {current?.data && (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <CompareTable data={current.data} diff={diff} />
        </div>
      )}

      <PaperSelector
        open={picking}
        onOpenChange={setPicking}
        papers={papers}
        min={2}
        max={3}
        title="Select papers to compare"
        confirmLabel="Compare"
        initial={valid ? ids : []}
        onConfirm={(picked) => {
          setPicking(false);
          router.replace(`/compare?ids=${picked.join(",")}`);
        }}
      />
    </div>
  );
}
