"use client";

import { Lightbulb, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useDismissed } from "@/hooks/use-dismissed";

export function OnboardingHint() {
  const [dismissed, dismiss] = useDismissed("insightrag:onboarding:v1");
  if (dismissed) return null;

  return (
    <Card className="flex-row items-start gap-3 border-primary/40 bg-primary-soft p-4 shadow-sm">
      <Lightbulb className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <p className="flex-1 text-[15px] text-text">
        <strong className="font-semibold">New here?</strong> Add a paper, then ask it anything. Answers come with sources
        you can open.
      </p>
      <Button variant="ghost" size="icon" className="-mt-1 -mr-1 size-11 sm:size-8" onClick={dismiss} aria-label="Dismiss hint">
        <X aria-hidden />
      </Button>
    </Card>
  );
}
