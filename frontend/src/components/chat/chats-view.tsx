"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PaperSelector } from "@/components/library/paper-selector";
import { api, errorMessage } from "@/lib/api";
import { shortTitle } from "@/lib/format";
import type { PaperSummary, Session } from "@/types/api";

const MAX_PAPERS = 3;

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export function ChatsView() {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [papers, setPapers] = useState<PaperSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.listSessions(), api.listPapers()])
      .then(([s, p]) => {
        if (cancelled) return;
        setSessions(s);
        setPapers(p);
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  const titleOf = new Map((papers ?? []).map((p) => [p.id, p.title] as const));

  async function startChat(ids: string[]) {
    try {
      const session = await api.createSession(ids);
      router.push(`/chat/${session.id}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold">Chats</h1>
          <p className="mt-1 text-text-muted">Pick up a conversation, or start one across up to 3 papers.</p>
        </div>
        <Button onClick={() => setPicking(true)}>
          <Plus aria-hidden /> New chat
        </Button>
      </div>

      {error && !sessions && (
        <Card className="items-start gap-3 p-4">
          <p>{error}</p>
          <Button variant="outline" size="sm" onClick={() => location.reload()}>
            Try again
          </Button>
        </Card>
      )}

      {!sessions && !error && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {sessions && sessions.length === 0 && (
        <Card className="items-center gap-3 p-8 text-center">
          <MessageSquare className="size-8 text-primary" aria-hidden />
          <div>
            <h2 className="text-[20px] font-semibold">No chats yet</h2>
            <p className="text-text-muted">Ask a question on any paper, or start a chat across several.</p>
          </div>
          <Button onClick={() => setPicking(true)}>New chat</Button>
        </Card>
      )}

      {sessions && sessions.length > 0 && (
        <ul className="space-y-3">
          {sessions.map((s) => {
            const names = s.paper_ids.map((id) => titleOf.get(id)).filter((t): t is string => !!t);
            const title = s.title ?? (names.length ? shortTitle(names.join(" + "), 90) : "Chat");
            return (
              <li key={s.id}>
                <Link
                  href={`/chat/${s.id}`}
                  className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <Card className="gap-1 p-4 shadow-sm transition-colors hover:bg-primary-soft">
                    <h2 className="line-clamp-2 text-[16px] font-semibold leading-snug">{title}</h2>
                    <p className="text-[13px] text-text-muted">
                      {s.paper_ids.length} {s.paper_ids.length === 1 ? "paper" : "papers"} · {timeAgo(s.updated_at)}
                    </p>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <PaperSelector
        open={picking}
        onOpenChange={setPicking}
        papers={papers}
        min={1}
        max={MAX_PAPERS}
        title="New chat"
        confirmLabel="Start chat"
        onConfirm={(ids) => void startChat(ids)}
      />
    </div>
  );
}
