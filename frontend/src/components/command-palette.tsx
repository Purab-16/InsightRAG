"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  FileText,
  GitCompare,
  Library,
  MessageSquare,
  Moon,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { api } from "@/lib/api";
import { shortTitle } from "@/lib/format";
import type { PaperSummary, Session } from "@/types/api";

const PAGES = [
  { href: "/", label: "Library", icon: Library },
  { href: "/chats", label: "Chats", icon: MessageSquare },
  { href: "/compare", label: "Compare", icon: GitCompare },
];

/** Ctrl/Cmd+K jump menu for pages, ready papers and chats. Data loads when it opens, not before. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{
    papers: PaperSummary[];
    sessions: Session[];
  } | null>(null);
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  const show = useCallback((next: boolean) => {
    setOpen(next);
    if (next) {
      Promise.all([api.listPapers(), api.listSessions()])
        .then(([papers, sessions]) => setData({ papers, sessions }))
        .catch(() => {
          // Pages and actions still work without the lists.
        });
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        show(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, show]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  const titleOf = new Map(
    (data?.papers ?? []).map((p) => [p.id, p.title] as const),
  );
  const ready = (data?.papers ?? []).filter((p) => p.status === "ready");

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => show(true)}
        aria-label="Search papers and chats (Ctrl+K)"
        className="gap-2 text-text-muted max-md:size-11"
      >
        <Search className="size-4" aria-hidden />
        <kbd className="hidden rounded border border-border px-1.5 text-[12px] font-sans lg:inline">
          Ctrl K
        </kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={show}
        title="Search"
        description="Jump to a page, paper or chat"
      >
        <Command>
          <CommandInput placeholder="Search papers, chats and pages…" />
          <CommandList>
            <CommandEmpty>Nothing found.</CommandEmpty>

            <CommandGroup heading="Pages">
              {PAGES.map(({ href, label, icon: Icon }) => (
                <CommandItem
                  key={href}
                  value={`page ${label}`}
                  onSelect={() => go(href)}
                >
                  <Icon aria-hidden /> {label}
                </CommandItem>
              ))}
              <CommandItem
                value="toggle dark mode theme"
                onSelect={() => {
                  setTheme(resolvedTheme === "dark" ? "light" : "dark");
                  setOpen(false);
                }}
              >
                <Moon aria-hidden /> Toggle dark mode
              </CommandItem>
            </CommandGroup>

            {ready.length > 0 && (
              <CommandGroup heading="Papers">
                {ready.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`paper ${p.title} ${p.authors.join(" ")}`}
                    onSelect={() => go(`/paper/${p.id}`)}
                  >
                    <FileText aria-hidden /> {shortTitle(p.title, 70)}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {(data?.sessions.length ?? 0) > 0 && (
              <CommandGroup heading="Chats">
                {data!.sessions.map((s) => {
                  const names = s.paper_ids
                    .map((id) => titleOf.get(id))
                    .filter((t): t is string => !!t);
                  const title =
                    s.title ?? (names.length ? names.join(" + ") : "Chat");
                  return (
                    <CommandItem
                      key={s.id}
                      value={`chat ${title}`}
                      onSelect={() => go(`/chat/${s.id}`)}
                    >
                      <MessageSquare aria-hidden /> {shortTitle(title, 70)}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
