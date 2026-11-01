"use client";

import { useEffect, useSyncExternalStore } from "react";
import { api, USAGE_CHANGED } from "@/lib/api";
import type { Usage } from "@/types/api";

// One shared copy for every component that shows usage (sidebar, top bar, library, chat), so a page load
// makes a single /me/usage call instead of one per component.
const FRESH_MS = 5000;
let current: Usage | null = null;
let fetchedAt = 0;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function refresh(force = false): Promise<void> {
  if (!force && current && Date.now() - fetchedAt < FRESH_MS) return Promise.resolve();
  inflight ??= api
    .usage()
    .then((u) => {
      current = u;
      fetchedAt = Date.now();
      listeners.forEach((l) => l());
    })
    .catch(() => {
      // The meter is a hint only; keep the last value if this fails.
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

const onUsageChanged = () => void refresh(true);

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener(USAGE_CHANGED, onUsageChanged);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener(USAGE_CHANGED, onUsageChanged);
  };
}

/** Today's quota use. Refetches when a paper is added or a message is sent. */
export function useUsage(): Usage | null {
  const usage = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
  useEffect(() => {
    void refresh();
  }, []);
  return usage;
}
