"use client";

import "@xyflow/react/dist/style.css";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Background, Controls, MiniMap, ReactFlow } from "@xyflow/react";
import { useTheme } from "next-themes";
import { List, Loader2, Network, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { layoutGraph, type PaperFlowNode } from "@/components/graph/layout";
import { NodeDetails } from "@/components/graph/node-details";
import { PaperNode } from "@/components/graph/paper-node";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { GraphResponse } from "@/types/api";

type Filter = "both" | "reference" | "citation";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "both", label: "Both" },
  { value: "reference", label: "References" },
  { value: "citation", label: "Citations" },
];

// Nodes per side. Starts small so labels stay readable; "Show more" steps up (the backend allows 5 to 50).
const LIMITS = [12, 25, 50];

// Declared once so React Flow does not see a new object on every render.
const NODE_TYPES = { paper: PaperNode };

export function CitationGraph({ paperId }: { paperId: string }) {
  // `limit` on the state is the size that was actually loaded; `wanted` is what the user asked for.
  const [state, setState] = useState<{ data?: GraphResponse; error?: string; limit: number } | null>(null);
  const [wanted, setWanted] = useState(LIMITS[0]);
  const [filter, setFilter] = useState<Filter>("both");
  const [asList, setAsList] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();

  const load = useCallback(
    () =>
      api
        .graph(paperId, wanted)
        .then((data) => setState({ data, limit: wanted }))
        // Keep the graph already on screen if only "Show more" failed.
        .catch((e) => setState((prev) => (prev?.data ? { ...prev, error: errorMessage(e), limit: wanted } : { error: errorMessage(e), limit: wanted }))),
    [paperId, wanted],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    if (!state?.data) return null;
    const nodes = state.data.nodes.filter((n) => n.kind === "center" || filter === "both" || n.kind === filter);
    const ids = new Set(nodes.map((n) => n.id));
    return { nodes, edges: state.data.edges.filter((e) => ids.has(e.source) && ids.has(e.target)) };
  }, [state, filter]);

  const flow = useMemo(
    () => (visible ? layoutGraph(visible.nodes, visible.edges, selectedId) : null),
    [visible, selectedId],
  );

  if (!state) return <Skeleton className="h-[480px] w-full" />;

  if (!state.data) {
    return (
      <Card className="items-start gap-3 p-4">
        <p>{state.error ?? "Something went wrong. Try again."}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setState(null);
            void load();
          }}
        >
          Try again
        </Button>
      </Card>
    );
  }

  // The backend returns just the centre node when Semantic Scholar has nothing.
  if (state.data.nodes.length <= 1) {
    return (
      <Card className="p-4">
        <p className="text-text">No citation data found for this paper.</p>
      </Card>
    );
  }

  const nextLimit = LIMITS.find((l) => l > state.limit);
  // Offer more only if a side came back full; otherwise there is nothing more to load.
  const full =
    state.data.nodes.filter((n) => n.kind === "reference").length >= state.limit ||
    state.data.nodes.filter((n) => n.kind === "citation").length >= state.limit;
  const loadingMore = wanted !== state.limit;
  const selected = state.data.nodes.find((n) => n.id === selectedId) ?? null;
  const references = visible!.nodes.filter((n) => n.kind === "reference");
  const citations = visible!.nodes.filter((n) => n.kind === "citation");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Show" className="flex gap-1">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={filter === f.value ? "default" : "outline"}
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        <ul className="flex flex-wrap items-center gap-4 text-[13px] text-text-muted" aria-label="Legend">
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-3 rounded-sm bg-primary" /> This paper
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-3 rounded-sm border-2 border-graph-ref" /> References
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-3 rounded-sm border-2 border-graph-cite" /> Citations
          </li>
          <li>Newer papers have a stronger border. Wider box = more citations.</li>
        </ul>

        <Button size="sm" variant="outline" onClick={() => setAsList((v) => !v)}>
          {asList ? <Network aria-hidden /> : <List aria-hidden />}
          {asList ? "View as graph" : "View as list"}
        </Button>
      </div>

      {asList ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { title: "References", items: references },
            { title: "Cited by", items: citations },
          ].map(({ title, items }) => (
            <section key={title} aria-label={title} className="space-y-2">
              <h3 className="text-[16px] font-semibold">
                {title} ({items.length})
              </h3>
              {items.length === 0 ? (
                <p className="text-[14px] text-text-muted">None shown.</p>
              ) : (
                <ul className="space-y-2">
                  {items.map((n) => (
                    <li key={n.id}>
                      <Card className="p-3 shadow-sm">
                        <NodeDetails node={n} compact />
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      ) : (
        <div className={cn("grid gap-3", selected && "lg:grid-cols-[1fr_340px]")}>
          <div
            className="relative h-[560px] overflow-hidden rounded-xl border border-border bg-surface"
            role="application"
            aria-label="Citation graph. Use View as list for an accessible version."
          >
            <div aria-hidden className="pointer-events-none absolute inset-x-3 top-3 z-10 flex justify-between">
              <span className="label-mono rounded-md bg-surface/90 px-2 py-1 text-graph-ref">
                Foundations (cited by focal) · {references.length}
              </span>
              <span className="label-mono rounded-md bg-surface/90 px-2 py-1 text-graph-cite">
                Influenced (cite focal) · {citations.length}
              </span>
            </div>
            <ReactFlow<PaperFlowNode>
              key={`${state.limit}-${filter}`}
              nodes={flow!.nodes}
              edges={flow!.edges}
              nodeTypes={NODE_TYPES}
              colorMode={resolvedTheme === "dark" ? "dark" : "light"}
              fitView
              fitViewOptions={{ padding: 0.15 }}
              minZoom={0.2}
              nodesDraggable={false}
              nodesConnectable={false}
              edgesFocusable={false}
              onNodeClick={(_, n) => setSelectedId(n.id)}
              onPaneClick={() => setSelectedId(null)}
              defaultEdgeOptions={{ style: { stroke: "var(--text-muted)" } }}
            >
              <Background gap={20} />
              <Controls showInteractive={false} />
              <MiniMap
                pannable
                zoomable
                ariaLabel="Graph overview"
                maskColor="color-mix(in srgb, var(--background) 70%, transparent)"
                className="!hidden !bg-surface md:!block"
              />
            </ReactFlow>
          </div>

          {selected && (
            <Card className="h-fit p-4 shadow-sm" aria-live="polite">
              <p className="label-mono mb-2">Selected node</p>
              <NodeDetails node={selected} />
            </Card>
          )}
        </div>
      )}

      {state.error && (
        <p className="text-[14px] text-danger" role="alert">
          {state.error}
        </p>
      )}

      {nextLimit && full && (
        <Button variant="outline" size="sm" disabled={loadingMore} onClick={() => setWanted(nextLimit)}>
          {loadingMore ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
          Show more (up to {nextLimit} per side)
        </Button>
      )}
    </div>
  );
}
