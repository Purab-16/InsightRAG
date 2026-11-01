"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api";
import { formatAuthors } from "@/lib/format";
import type { ArxivResult } from "@/types/api";

const DEBOUNCE_MS = 400;
const MIN_CHARS = 3;

interface Props {
  /** Adds the paper; resolves true if the request was accepted. */
  onAdd: (arxivId: string) => Promise<boolean>;
}

export function ArxivSearch({ onAdd }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ArxivResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  // "/" focuses the search box, like most search UIs.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onChange(value: string) {
    setQuery(value);
    if (value.trim().length < MIN_CHARS) {
      setResults(null);
      setError(null);
    }
  }

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_CHARS) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const found = await api.searchArxiv(q);
        if (!cancelled) {
          setResults(found);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(errorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  async function add(id: string) {
    setAdding(id);
    try {
      if (await onAdd(id)) setAdded((prev) => new Set(prev).add(id));
    } finally {
      setAdding(null);
    }
  }

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted" aria-hidden />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => onChange(e.target.value)}
          placeholder='Search arXiv (e.g. "diffusion models")'
          aria-label="Search arXiv"
          maxLength={200}
          className="h-11 bg-surface pl-9"
        />
        {loading && (
          <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-text-muted" aria-hidden />
        )}
      </div>

      <div aria-live="polite">
        {error && <p className="mt-3 text-[14px] text-danger">{error}</p>}

        {loading && !results && (
          <div className="mt-4 space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        )}

        {results && results.length === 0 && (
          <p className="mt-4 text-[14px] text-text-muted">No papers found. Try different words.</p>
        )}

        {results && results.length > 0 && (
          <ul className="mt-4 space-y-3">
            {results.map((r) => {
              const inLibrary = r.in_library || added.has(r.arxiv_id);
              return (
                <li key={r.arxiv_id}>
                  <Card className="gap-1.5 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-[16px] font-semibold leading-snug">{r.title}</h3>
                      <Button
                        size="sm"
                        variant={inLibrary ? "outline" : "default"}
                        disabled={inLibrary || adding !== null}
                        onClick={() => add(r.arxiv_id)}
                        className="shrink-0"
                        aria-label={inLibrary ? `${r.title}: in library` : `Add ${r.title}`}
                      >
                        {inLibrary ? (
                          <>
                            <Check aria-hidden /> In library
                          </>
                        ) : adding === r.arxiv_id ? (
                          <Loader2 className="animate-spin" aria-hidden />
                        ) : (
                          <>
                            <Plus aria-hidden /> Add
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-[13px] text-text-muted">
                      {formatAuthors(r.authors)} · {r.published.slice(0, 4)} ·{" "}
                      <span className="font-mono">{r.categories[0] ?? r.arxiv_id}</span>
                    </p>
                    <p className="line-clamp-2 text-[14px] text-text-muted">{r.abstract}</p>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
