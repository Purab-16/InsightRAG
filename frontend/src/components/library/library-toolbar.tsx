"use client";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PaperStatus, PaperSummary } from "@/types/api";

export type SortKey = "newest" | "oldest" | "title";
export type StatusFilter = "all" | PaperStatus;

export interface ViewState {
  query: string;
  sort: SortKey;
  status: StatusFilter;
}

export const DEFAULT_VIEW: ViewState = { query: "", sort: "newest", status: "all" };

const SORTS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "title", label: "Title A to Z" },
];

const STATUSES: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ready", label: "Ready" },
  { value: "processing", label: "Processing" },
  { value: "failed", label: "Failed" },
];

export function isFiltered(view: ViewState): boolean {
  return view.query.trim() !== "" || view.status !== "all";
}

/** Filters by title or author text and status, then sorts. Returns a new array. */
export function applyView(papers: PaperSummary[], view: ViewState): PaperSummary[] {
  const q = view.query.trim().toLowerCase();
  const list = papers.filter(
    (p) =>
      (view.status === "all" || p.status === view.status) &&
      (q === "" || p.title.toLowerCase().includes(q) || p.authors.some((a) => a.toLowerCase().includes(q))),
  );
  return list.toSorted((a, b) => {
    if (view.sort === "title") return a.title.localeCompare(b.title);
    const diff = new Date(a.added_at).getTime() - new Date(b.added_at).getTime();
    return view.sort === "oldest" ? diff : -diff;
  });
}

interface Props {
  view: ViewState;
  onChange: (view: ViewState) => void;
  shown: number;
  total: number;
}

export function LibraryToolbar({ view, onChange, shown, total }: Props) {
  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted" aria-hidden />
          <Input
            type="search"
            value={view.query}
            onChange={(e) => onChange({ ...view, query: e.target.value })}
            placeholder="Filter by title or author"
            aria-label="Filter your papers"
            className="h-10 pl-9"
          />
          <kbd
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[11px] text-text-muted sm:block"
          >
            Ctrl K
          </kbd>
        </div>
        <select
          value={view.sort}
          onChange={(e) => onChange({ ...view, sort: e.target.value as SortKey })}
          aria-label="Sort papers"
          className="h-10 rounded-lg border border-input bg-surface px-3 text-[14px] text-text focus-visible:outline-2 focus-visible:outline-ring"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Status" className="flex flex-wrap gap-1">
          {STATUSES.map((s) => (
            <Button
              key={s.value}
              size="sm"
              variant={view.status === s.value ? "default" : "outline"}
              aria-pressed={view.status === s.value}
              onClick={() => onChange({ ...view, status: s.value })}
            >
              {s.label}
            </Button>
          ))}
        </div>
        {isFiltered(view) && (
          <p className="text-[13px] text-text-muted" aria-live="polite">
            Showing {shown} of {total}
          </p>
        )}
      </div>
    </div>
  );
}
