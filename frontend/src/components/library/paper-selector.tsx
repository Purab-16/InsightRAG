"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAuthors } from "@/lib/format";
import type { PaperSummary } from "@/types/api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null while the library is loading. Only ready papers can be picked. */
  papers: PaperSummary[] | null;
  min: number;
  max: number;
  title: string;
  confirmLabel: string;
  initial?: string[];
  onConfirm: (ids: string[]) => void;
}

export function PaperSelector(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <SelectorBody {...props} />
      </DialogContent>
    </Dialog>
  );
}

// Lives inside DialogContent so the selection resets every time the dialog opens.
function SelectorBody({ papers, min, max, title, confirmLabel, initial = [], onConfirm }: Props) {
  const [picked, setPicked] = useState<string[]>(initial);
  const ready = papers?.filter((p) => p.status === "ready") ?? [];
  const rule = min === max ? `Pick ${min}` : `Pick ${min} to ${max}`;

  function toggle(id: string, on: boolean) {
    setPicked((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)));
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          {rule} papers. {picked.length} selected.
        </DialogDescription>
      </DialogHeader>

      {!papers && <Skeleton className="h-32 w-full" />}

      {papers && ready.length === 0 && (
        <p className="text-[14px] text-text-muted">No ready papers yet. Add a paper in your library first.</p>
      )}

      {ready.length > 0 && (
        <ul className="space-y-1">
          {ready.map((p) => {
            const checked = picked.includes(p.id);
            const id = `pick-${p.id}`;
            return (
              <li key={p.id}>
                <label
                  htmlFor={id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg p-2.5 hover:bg-primary-soft"
                >
                  <Checkbox
                    id={id}
                    checked={checked}
                    disabled={!checked && picked.length >= max}
                    onCheckedChange={(v) => toggle(p.id, v === true)}
                    className="mt-1"
                  />
                  <span>
                    <span className="line-clamp-2 text-[15px] font-medium leading-snug text-text">{p.title}</span>
                    <span className="text-[13px] text-text-muted">{formatAuthors(p.authors)}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <DialogFooter>
        <Button disabled={picked.length < min || picked.length > max} onClick={() => onConfirm(picked)}>
          {confirmLabel}
        </Button>
      </DialogFooter>
    </>
  );
}
