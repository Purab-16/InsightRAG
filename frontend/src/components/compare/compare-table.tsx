import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { paperColor, paperLetter } from "@/lib/paper-colors";
import { cn } from "@/lib/utils";
import type { CompareResponse, Insights } from "@/types/api";

/** Lists keyed by item; `shared` holds the (lower-cased) items that appear in more than one paper. */
type ListKey = "datasets" | "metrics";
type Row = { label: string; render: (i: Insights, shared: Set<string> | null) => React.ReactNode; list?: ListKey };

function chips(items: string[], shared: Set<string> | null) {
  if (items.length === 0) return <span className="text-text-muted">None listed</span>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => {
        const common = shared?.has(item.toLowerCase());
        return (
          <li key={item}>
            <Badge
              variant="secondary"
              className={cn(
                "rounded-full text-[13px] font-normal text-text",
                shared && (common ? "opacity-50" : "ring-1 ring-primary"),
              )}
            >
              {item}
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}

function bullets(items: string[]) {
  if (items.length === 0) return <span className="text-text-muted">None listed</span>;
  return (
    <ul className="list-disc space-y-1 pl-4">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export const ROWS: Row[] = [
  { label: "TL;DR", render: (i) => i.tldr },
  { label: "Problem", render: (i) => i.problem },
  { label: "Method", render: (i) => i.method },
  { label: "Datasets", list: "datasets", render: (i, s) => chips(i.datasets, s) },
  { label: "Metrics", list: "metrics", render: (i, s) => chips(i.metrics, s) },
  { label: "Key results", render: (i) => bullets(i.key_results) },
  { label: "Limitations", render: (i) => bullets(i.limitations) },
  { label: "Contributions", render: (i) => bullets(i.contributions) },
];

/** Items that more than one paper lists, for the Diff Highlights toggle. */
function sharedItems(data: CompareResponse, key: ListKey): Set<string> {
  const seen = new Map<string, number>();
  for (const p of data.papers) {
    for (const item of new Set(p.insights[key].map((x) => x.toLowerCase()))) {
      seen.set(item, (seen.get(item) ?? 0) + 1);
    }
  }
  return new Set([...seen].filter(([, n]) => n > 1).map(([item]) => item));
}

/**
 * Side-by-side insights. The first column stays put while the table scrolls sideways on small screens.
 * With `diff` on, datasets and metrics that every paper does not share get a ring and shared ones fade.
 */
export function CompareTable({ data, diff = false }: { data: CompareResponse; diff?: boolean }) {
  return (
    <Table className="min-w-[760px] table-fixed border-separate border-spacing-0 text-[14px]">
      <caption className="sr-only">Insights compared across {data.papers.length} papers</caption>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead scope="col" className="sticky left-0 z-10 w-40 bg-surface" />
          {data.papers.map((p, i) => (
            <TableHead key={p.paper_id} scope="col" className="h-auto bg-surface py-3 align-top whitespace-normal">
              <Link
                href={`/paper/${p.paper_id}`}
                className="flex items-start gap-2 text-[15px] leading-snug font-semibold text-text hover:underline"
              >
                <span
                  aria-hidden
                  style={{ backgroundColor: paperColor(i) }}
                  className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-sm text-[11px] text-primary-foreground"
                >
                  {paperLetter(i)}
                </span>
                <span className="line-clamp-3">
                  <span className="sr-only">Paper {paperLetter(i)}: </span>
                  {p.title}
                </span>
              </Link>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {ROWS.map((row, index) => (
          <TableRow key={row.label} className="hover:bg-transparent">
            <TableHead scope="row" className="label-mono sticky left-0 z-10 border-t border-border bg-surface align-top">
              <span className="text-primary">{String(index + 1).padStart(2, "0")}</span> {row.label}
            </TableHead>
            {data.papers.map((p) => (
              <TableCell key={p.paper_id} className="border-t border-border align-top whitespace-normal">
                {row.render(p.insights, diff && row.list ? sharedItems(data, row.list) : null)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
