"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GitCompare, Library, Sparkles, type LucideIcon } from "lucide-react";
import { AccountBlock } from "@/components/auth/account-block";
import { useUsage } from "@/hooks/use-usage";
import { cn } from "@/lib/utils";

export const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Paper Library", icon: Library },
  { href: "/chats", label: "RAG Workspace", icon: Sparkles },
  { href: "/compare", label: "Compare Insights", icon: GitCompare },
];

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/paper");
  if (href === "/chats") return pathname.startsWith("/chat");
  return pathname.startsWith(href);
}

export function Brand() {
  return (
    <Link href="/" className="flex min-h-11 items-center gap-2 text-[16px] font-semibold text-text">
      <span aria-hidden className="text-primary">
        ◆
      </span>
      InsightRAG
    </Link>
  );
}

/** Nav links, shared by the desktop sidebar and the mobile menu. */
export function NavLinks({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className={cn("flex flex-col gap-1", className)}>
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-10 items-center gap-3 rounded-lg border-l-2 px-3 text-[15px] transition-colors hover:bg-primary-soft/60",
              active
                ? "border-primary bg-primary-soft/60 font-medium text-primary"
                : "border-transparent text-text-muted hover:text-text",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Daily paper quota. Only shows what the usage endpoint returns. */
function QuotaCard() {
  const usage = useUsage();
  if (!usage) return null;
  const pct = Math.min(100, Math.round((usage.papers_used_today / Math.max(1, usage.papers_limit)) * 100));
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-center justify-between">
        <span className="label-mono">Anonymous tier</span>
      </div>
      <div
        role="progressbar"
        aria-label="Papers added today"
        aria-valuenow={usage.papers_used_today}
        aria-valuemin={0}
        aria-valuemax={usage.papers_limit}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-border"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <p className="label-mono mt-2 normal-case">
        Quota: {usage.papers_used_today}/{usage.papers_limit} papers today
      </p>
    </div>
  );
}

export function AppSidebar() {
  return (
    <aside
      aria-label="Sidebar"
      className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-surface md:flex print:hidden"
    >
      <div className="flex h-16 items-center border-b border-border px-5">
        <Brand />
      </div>

      <div className="flex-1 space-y-2 px-3 py-5">
        <p className="label-mono px-3 pb-1">Workspaces</p>
        <NavLinks />
      </div>

      <div className="space-y-3 border-t border-border p-3">
        <QuotaCard />
        <AccountBlock />
      </div>
    </aside>
  );
}
