"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import { shortTitle } from "@/lib/format";
import type { PaperStatus, PaperSummary } from "@/types/api";

const POLL_MS = 4000;

/** The user's library. Polls while any paper is processing, and pauses while the tab is hidden. */
export function usePapers() {
  const [papers, setPapers] = useState<PaperSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const known = useRef(new Map<string, PaperStatus>());

  const refresh = useCallback(
    () =>
      api
        .listPapers()
        .then((list) => {
          for (const p of list) {
            if (known.current.get(p.id) === "processing" && p.status === "ready") {
              toast.success(`'${shortTitle(p.title)}' is ready`);
            }
            known.current.set(p.id, p.status);
          }
          setPapers(list);
          setError(null);
        })
        .catch((e) => setError(errorMessage(e))),
    [],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasProcessing = papers?.some((p) => p.status === "processing") ?? false;

  useEffect(() => {
    if (!hasProcessing) return;
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick); // refresh right away when the tab comes back
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [hasProcessing, refresh]);

  return { papers, error, refresh };
}
