"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageBubble, type ChatMessage } from "@/components/chat/message-bubble";
import type { Inspected } from "@/components/chat/chunk-inspector";
import { SourceDrawer } from "@/components/chat/source-drawer";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { LimitBanner, UsageMeter } from "@/components/usage/usage-meter";
import { useUsage } from "@/hooks/use-usage";
import { api, errorMessage } from "@/lib/api";
import type { Source } from "@/types/api";

const SUGGESTED = ["Summarize the main idea", "What datasets and metrics are used?", "What are the limitations?"];

interface Props {
  paperIds: string[];
  /** Existing chat to continue. Without it, one is created on the first question. */
  sessionId?: string;
  pdfUrlFor: (paperId: string) => string | null;
  placeholder?: string;
  /** CSS colour per paper id, so chips show which paper a source is from. */
  accentFor?: (paperId: string) => string | undefined;
  /** When set, citation clicks go here on wide screens (the workspace inspector) instead of the drawer. */
  onInspect?: (selection: Inspected) => void;
  className?: string;
}

export function ChatPanel({
  paperIds,
  sessionId: initialSession,
  pdfUrlFor,
  placeholder = "Ask about this paper…",
  accentFor,
  onInspect,
  className,
}: Props) {
  const wide = useMediaQuery("(min-width: 1024px)");
  const [sessionId, setSessionId] = useState<string | null>(initialSession ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  // Round-trip time per assistant message, measured here. Messages loaded from history have none.
  const [latency, setLatency] = useState<Record<string, number>>({});
  const [openSource, setOpenSource] = useState<Source | null>(null);
  const usage = useUsage();

  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const key = paperIds.join(",");

  // Continue the latest chat that has exactly these papers, so a reload keeps the conversation.
  useEffect(() => {
    let cancelled = false;
    const find = initialSession
      ? Promise.resolve(initialSession)
      : api.listSessions().then((all) => all.find((s) => s.paper_ids.join(",") === key)?.id ?? null);

    find
      .then((id) => (id ? api.getMessages(id).then((r) => ({ id, messages: r.messages })) : null))
      .then((found) => {
        if (cancelled) return;
        if (found) {
          setSessionId(found.id);
          setMessages(found.messages);
        }
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        toast.error(errorMessage(e));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialSession, key]);

  // Follow new messages unless the user scrolled up to read.
  useEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const send = useCallback(
    async (text: string, retryOf?: string) => {
      const content = text.trim();
      if (!content || sending) return;

      const tempId = retryOf ?? `local-${Date.now()}`;
      const local: ChatMessage = {
        id: tempId,
        role: "user",
        content,
        sources: null,
        created_at: new Date().toISOString(),
      };
      stickToBottom.current = true;
      setMessages((prev) => (retryOf ? prev.map((m) => (m.id === retryOf ? local : m)) : [...prev, local]));
      setDraft("");
      setSending(true);

      try {
        let id = sessionId;
        if (!id) {
          id = (await api.createSession(paperIds)).id;
          setSessionId(id);
        }
        const started = performance.now();
        const res = await api.sendMessage(id, content);
        const took = Math.round(performance.now() - started);
        setLatency((prev) => ({ ...prev, [res.assistant_message.id]: took }));
        setMessages((prev) => [...prev.filter((m) => m.id !== tempId), res.user_message, res.assistant_message]);
      } catch (e) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, failed: true } : m)));
        toast.error(errorMessage(e));
      } finally {
        setSending(false);
      }
    },
    [paperIds, sending, sessionId],
  );

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(draft);
    }
  }

  const empty = !loading && messages.length === 0;

  function openSourceFor(source: Source) {
    if (!onInspect || !wide) {
      setOpenSource(source);
      return;
    }
    const msg = messages.find((m) => m.sources?.some((s) => s.n === source.n && s.chunk_id === source.chunk_id));
    onInspect({ source, others: (msg?.sources ?? []).filter((s) => s.n !== source.n) });
  }

  return (
    <div className={cn("flex h-[70dvh] min-h-[420px] flex-col rounded-xl border border-border bg-surface print:h-auto print:min-h-0 print:border-0", className)}>
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6 print:overflow-visible print:p-0"
        role="log"
        aria-live="polite"
        aria-label="Conversation"
      >
        {empty && (
          <div className="print:hidden">
            <p className="label-mono mb-3">Prompts</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED.map((q) => (
                <Button key={q} variant="outline" size="sm" className="h-auto whitespace-normal py-1.5 text-left" onClick={() => void send(q)}>
                  {q}
                </Button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            onOpenSource={openSourceFor}
            accentFor={accentFor}
            latencyMs={latency[m.id]}
            onRetry={(failed) => void send(failed.content, failed.id)}
          />
        ))}

        {sending && (
          <p className="text-[14px] text-text-muted" role="status">
            Reading the papers
            <span aria-hidden className="ml-0.5 inline-flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-1 animate-bounce rounded-full bg-text-muted motion-reduce:animate-none"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </span>
          </p>
        )}
      </div>

      {!empty && !loading && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 pt-2 print:hidden">
          <span className="label-mono">Prompts</span>
          {SUGGESTED.slice(0, 3).map((q) => (
            <Button key={q} variant="outline" size="sm" disabled={sending} className="h-7 text-[12px]" onClick={() => void send(q)}>
              {q}
            </Button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
        className="flex items-end gap-2 border-t border-border p-3 print:hidden"
      >
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label="Your question"
          maxLength={2000}
          rows={1}
          className="max-h-32 min-h-11 resize-none"
        />
        <Button type="submit" disabled={sending || draft.trim() === ""} className="h-11">
          <Send aria-hidden /> Send
        </Button>
      </form>
      <div className="flex flex-col gap-2 border-t border-border px-3 py-2 print:hidden">
        <LimitBanner usage={usage} kind="messages" />
        <UsageMeter usage={usage} kind="messages" />
      </div>

      <SourceDrawer source={openSource} onClose={() => setOpenSource(null)} pdfUrlFor={pdfUrlFor} />
    </div>
  );
}
