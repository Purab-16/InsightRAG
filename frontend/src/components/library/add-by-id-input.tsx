"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { looksLikeArxivId } from "@/lib/format";

export function AddByIdInput({ onAdd }: { onAdd: (arxivId: string) => Promise<boolean> }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!looksLikeArxivId(value)) {
      setError("Enter a valid arXiv ID (e.g. 2310.06825) or link.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (await onAdd(value.trim())) setValue("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="arxiv-id" className="text-[14px] text-text-muted">
          or add by arXiv ID:
        </label>
        <Input
          id="arxiv-id"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder="2310.06825"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "arxiv-id-error" : undefined}
          className="h-10 w-full max-w-xs bg-surface font-mono"
        />
        <Button type="submit" disabled={busy || value.trim() === ""}>
          {busy && <Loader2 className="animate-spin" aria-hidden />} Add
        </Button>
      </div>
      {error && (
        <p id="arxiv-id-error" className="mt-2 text-[14px] text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
