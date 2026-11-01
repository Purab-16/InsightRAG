"use client";

import { useCallback, useSyncExternalStore } from "react";

const EVENT = "dismissed-changed";

function read(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false; // storage blocked: show the hint, it just will not be remembered
  }
}

/** A remembered "got it" flag. Counts as dismissed on the server so the hint never flashes on load. */
export function useDismissed(key: string): [boolean, () => void] {
  const subscribe = useCallback((cb: () => void) => {
    window.addEventListener(EVENT, cb);
    window.addEventListener("storage", cb);
    return () => {
      window.removeEventListener(EVENT, cb);
      window.removeEventListener("storage", cb);
    };
  }, []);

  const dismissed = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => true,
  );

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(key, "1");
    } catch {
      // not remembered, but the event below still hides it for this visit
    }
    window.dispatchEvent(new Event(EVENT));
  }, [key]);

  return [dismissed, dismiss];
}
