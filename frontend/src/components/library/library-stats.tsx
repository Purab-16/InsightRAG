"use client";

import { useEffect, useState } from "react";
import { BookOpen, MessageSquare, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatLocalTime } from "@/lib/format";
import type { PaperSummary, Usage } from "@/types/api";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className="mt-3 h-1.5 overflow-hidden rounded-full bg-border"
    >
      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
    </div>
  );
}

function Stat({ label, icon: Icon, children }: { label: string; icon: typeof Zap; children: React.ReactNode }) {
  return (
    <Card className="gap-1 p-5">
      <div className="flex items-center justify-between">
        <span className="label-mono">{label}</span>
        <Icon className="size-4 text-primary" aria-hidden />
      </div>
      {children}
    </Card>
  );
}

/** Three stat cards built only from data the API already returns. */
export function LibraryStats({ papers, usage }: { papers: PaperSummary[] | null; usage: Usage | null }) {
  const total = papers?.length ?? 0;
  // The clock is read after mount, never during render or prerender (Next blocks Date.now there).
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the browser clock
    setNow(Date.now());
  }, []);
  const thisWeek =
    now === null ? 0 : (papers?.filter((p) => now - new Date(p.added_at).getTime() < WEEK_MS).length ?? 0);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Stat label="Total papers in library" icon={BookOpen}>
        <p className="text-[36px] leading-tight font-semibold">{papers ? total : "-"}</p>
        <p className="font-mono text-[12px] text-success">+{thisWeek} added this week</p>
      </Stat>

      <Stat label="Daily ingestion quota" icon={Zap}>
        {usage ? (
          <>
            <p className="text-[36px] leading-tight font-semibold">
              {usage.papers_used_today}
              <span className="text-[20px] font-normal text-text-muted">/{usage.papers_limit}</span>
              <span className="ml-2 font-mono text-[12px] font-normal text-success">adds today</span>
            </p>
            <Bar value={usage.papers_used_today} max={usage.papers_limit} label="Papers added today" />
            <p className="mt-2 font-mono text-[12px] text-text-muted">
              Resets at {formatLocalTime(new Date(usage.reset_at))}
            </p>
          </>
        ) : (
          <p className="text-[36px] leading-tight font-semibold">-</p>
        )}
      </Stat>

      <Stat label="Chat messages today" icon={MessageSquare}>
        {usage ? (
          <>
            <p className="text-[36px] leading-tight font-semibold">
              {usage.messages_used_today}
              <span className="text-[20px] font-normal text-text-muted">/{usage.messages_limit}</span>
            </p>
            <Bar value={usage.messages_used_today} max={usage.messages_limit} label="Messages sent today" />
          </>
        ) : (
          <p className="text-[36px] leading-tight font-semibold">-</p>
        )}
      </Stat>
    </div>
  );
}
