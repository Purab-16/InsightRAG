import { CheckCircle2, Hourglass, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PaperSummary } from "@/types/api";

// Same order as the backend pipeline (status_step values).
const STEPS = [
  { key: "downloading", label: "Downloading" },
  { key: "parsing", label: "Parsing" },
  { key: "chunking", label: "Chunking" },
  { key: "embedding", label: "Embedding" },
  { key: "insights", label: "Structured insights" },
];

/** Shows the paper that is processing right now, step by step. Renders nothing when none is. */
export function ProcessingQueue({ papers }: { papers: PaperSummary[] }) {
  const current = papers.find((p) => p.status === "processing");
  if (!current) return null;

  const index = Math.max(0, STEPS.findIndex((s) => s.key === current.status_step));
  const pct = Math.round(((index + 0.5) / STEPS.length) * 100);
  const waiting = papers.filter((p) => p.status === "processing").length - 1;

  return (
    <Card role="status" aria-live="polite" className="gap-4 p-5">
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
          <Hourglass className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="label-mono">Processing queue{waiting > 0 ? ` (+${waiting} waiting)` : ""}</p>
          <p className="truncate text-[16px] font-semibold">{current.title}</p>
        </div>
        <ol className="flex flex-wrap items-center gap-2" aria-label="Pipeline steps">
          {STEPS.map((s, i) => {
            const done = i < index;
            const active = i === index;
            return (
              <li
                key={s.key}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[12px]",
                  done && "border-success/40 bg-success/10 text-success",
                  active && "border-primary bg-primary-soft text-primary",
                  !done && !active && "border-border text-text-muted",
                )}
              >
                {done && <CheckCircle2 className="size-3.5" aria-hidden />}
                {active && <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />}
                {s.label}
              </li>
            );
          })}
        </ol>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-gradient-to-r from-primary to-success" style={{ width: `${pct}%` }} />
      </div>
    </Card>
  );
}
