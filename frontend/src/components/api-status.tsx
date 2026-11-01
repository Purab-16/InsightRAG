"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const EVERY_MS = 30000;

/** Small "API 24ms" pill for the top bar. Pings the public /health endpoint; pauses while the tab is hidden. */
export function ApiStatus() {
  const [ms, setMs] = useState<number | null | undefined>(undefined); // undefined = not measured yet

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (document.visibilityState !== "visible") return;
      void api.ping().then((v) => !cancelled && setMs(v));
    };
    run();
    const timer = setInterval(run, EVERY_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (ms === undefined) return null;
  return (
    <span
      className="hidden items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 font-mono text-[12px] text-text-muted lg:inline-flex"
      role="status"
    >
      <span aria-hidden className={cn("size-2 rounded-full", ms === null ? "bg-danger" : "bg-success")} />
      {ms === null ? "API offline" : `API ${ms}ms`}
    </span>
  );
}
