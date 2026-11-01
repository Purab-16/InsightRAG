"use client";

import { useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SourceChip } from "@/components/chat/source-chip";
import { cn } from "@/lib/utils";
import type { Message, Source } from "@/types/api";

export type ChatMessage = Message & { failed?: boolean };

const CITE_PREFIX = "#cite-";

/** Turns "[2]" into a markdown link "[2](#cite-2)" for sources that exist. Nothing is rendered as raw HTML. */
function linkCitations(content: string, sources: Source[]): string {
  const known = new Set(sources.map((s) => s.n));
  return content.replace(/\[(\d{1,2})\]/g, (m, n) => (known.has(Number(n)) ? `[${n}](${CITE_PREFIX}${n})` : m));
}

interface Props {
  message: ChatMessage;
  onOpenSource: (source: Source) => void;
  onRetry?: (message: ChatMessage) => void;
  /** CSS colour per paper id, for the chip accent in multi-paper chats. */
  accentFor?: (paperId: string) => string | undefined;
  /** Round-trip time of this answer, when it was measured in this session. */
  latencyMs?: number;
}

export function MessageBubble({ message, onOpenSource, onRetry, accentFor, latencyMs }: Props) {
  const isUser = message.role === "user";
  const sources = useMemo(() => message.sources ?? [], [message.sources]);

  const components = useMemo<Components>(
    () => ({
      a: ({ href, children }) => {
        if (href?.startsWith(CITE_PREFIX)) {
          const source = sources.find((s) => s.n === Number(href.slice(CITE_PREFIX.length)));
          if (source) return <SourceChip source={source} onOpen={onOpenSource} accent={accentFor?.(source.paper_id)} />;
        }
        return (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">
            {children}
          </a>
        );
      },
      p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
      ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
      ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
      code: ({ children }) => <code className="rounded bg-primary-soft px-1 font-mono text-[0.9em]">{children}</code>,
    }),
    [sources, onOpenSource, accentFor],
  );

  if (isUser) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className={cn("max-w-[85%] rounded-xl border border-border bg-background px-4 py-2.5 text-text", message.failed && "opacity-70")}>
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
        {message.failed && (
          <div className="flex items-center gap-2 text-[13px] text-danger">
            Couldn&apos;t send.
            <Button variant="outline" size="sm" onClick={() => onRetry?.(message)}>
              <RotateCw aria-hidden /> Retry
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-[75ch] text-text">
      <p className="mb-2 flex items-center gap-2 font-mono text-[12px] font-semibold text-primary">
        <span aria-hidden className="size-2 rounded-sm bg-primary" /> InsightRAG
        {(latencyMs !== undefined || sources.length > 0) && (
          <span className="font-normal text-text-muted">
            {latencyMs !== undefined && ` · Latency ${latencyMs}ms`}
            {sources.length > 0 && ` · ${sources.length} sources`}
          </span>
        )}
      </p>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {linkCitations(message.content, sources)}
      </ReactMarkdown>
    </div>
  );
}
