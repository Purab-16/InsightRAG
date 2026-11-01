"use client";

import { AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatLocalTime } from "@/lib/format";
import type { Usage } from "@/types/api";

export type Quota = "papers" | "messages";

function figures(usage: Usage, kind: Quota) {
  const used = kind === "papers" ? usage.papers_used_today : usage.messages_used_today;
  const limit = kind === "papers" ? usage.papers_limit : usage.messages_limit;
  return { left: Math.max(0, limit - used), limit };
}

/** "4 of 5 papers left today". Renders nothing until the usage has loaded. */
export function UsageMeter({ usage, kind }: { usage: Usage | null; kind: Quota }) {
  if (!usage) return null;
  const { left, limit } = figures(usage, kind);
  return (
    <p className="text-[13px] text-text-muted" aria-live="polite">
      {left} of {limit} {kind} left today
    </p>
  );
}

/** Shown once the daily limit is used up. Copy comes from UI_UX_DESIGN section 6. */
export function LimitBanner({ usage, kind }: { usage: Usage | null; kind: Quota }) {
  if (!usage || figures(usage, kind).left > 0) return null;
  const reset = formatLocalTime(new Date(usage.reset_at));
  const text =
    kind === "papers"
      ? `You've added ${usage.papers_limit} papers today. You can add more after ${reset}.`
      : `You've used today's ${usage.messages_limit} messages. Chat resets at ${reset}.`;
  return (
    <Card role="status" className="flex-row items-start gap-2 border-warning p-3 text-[14px] text-text">
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      {text}
    </Card>
  );
}
