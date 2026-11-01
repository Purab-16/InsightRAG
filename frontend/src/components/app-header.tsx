"use client";

import { useRouter } from "next/navigation";
import { BookOpen, MenuIcon, MessageSquare, Plus } from "lucide-react";
import { ApiStatus } from "@/components/api-status";
import { AccountBlock } from "@/components/auth/account-block";
import { Brand, NavLinks } from "@/components/app-sidebar";
import { CommandPalette } from "@/components/command-palette";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useUsage } from "@/hooks/use-usage";

function Pill({ icon: Icon, children }: { icon: typeof BookOpen; children: React.ReactNode }) {
  return (
    <span className="hidden items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 font-mono text-[12px] text-text-muted sm:inline-flex">
      <Icon className="size-3.5" aria-hidden />
      {children}
    </span>
  );
}

export function AppHeader() {
  const usage = useUsage();
  const router = useRouter();

  /** Scrolls to the add-paper box on the library, or opens the library there from any other page. */
  function goToAdd() {
    const box = document.getElementById("add-paper");
    if (!box) {
      router.push("/#add-paper");
      return;
    }
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    box.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
    box.querySelector("input")?.focus({ preventScroll: true });
  }

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-border bg-surface/95 backdrop-blur print:hidden">
      <div className="flex h-full items-center gap-3 px-4 sm:px-6">
        <div className="md:hidden">
          <Brand />
        </div>

        <ApiStatus />

        {usage && (
          <div role="group" className="flex items-center gap-2" aria-label="Today's usage">
            <Pill icon={BookOpen}>
              {usage.papers_used_today}/{usage.papers_limit} Papers
            </Pill>
            <Pill icon={MessageSquare}>
              {usage.messages_used_today}/{usage.messages_limit} msgs
            </Pill>
          </div>
        )}

        <div className="ml-auto flex items-center gap-1">
          <CommandPalette />
          <ThemeToggle />
          <Button size="sm" className="ml-1 hidden sm:inline-flex" onClick={goToAdd}>
            <Plus aria-hidden /> Add Document
          </Button>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="size-11 md:hidden" aria-label="Open menu">
                <MenuIcon className="size-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <NavLinks className="px-4" />
              <div className="mt-6 border-t border-border px-4 pt-4">
                <AccountBlock />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
