"use client";

import { useState } from "react";
import { ExternalLink, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { KIND_LABEL } from "@/components/graph/paper-node";
import { api, errorMessage } from "@/lib/api";
import type { GraphNode } from "@/types/api";

/** Details for one graph node, with the Semantic Scholar link and "Add to library" when it has an arXiv ID. */
export function NodeDetails({ node, compact = false }: { node: GraphNode; compact?: boolean }) {
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  async function add() {
    if (!node.arxiv_id) return;
    setAdding(true);
    try {
      const res = await api.addArxiv(node.arxiv_id);
      setAdded(true);
      toast.success(res.status === "ready" ? "Already in your library." : "Added. Processing usually takes under a minute.");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setAdding(false);
    }
  }

  const meta = [
    KIND_LABEL[node.kind],
    node.year,
    node.citation_count !== null ? `${node.citation_count.toLocaleString()} citations` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-2">
      <h3 className={compact ? "text-[15px] leading-snug font-medium" : "text-[16px] leading-snug font-semibold"}>
        {node.label}
      </h3>
      <p className="text-[13px] text-text-muted">{meta}</p>
      <div className="flex flex-wrap items-center gap-2">
        {node.url && (
          <Button variant="outline" size="sm" asChild>
            <a href={node.url} target="_blank" rel="noopener noreferrer">
              Open on Semantic Scholar <ExternalLink aria-hidden />
            </a>
          </Button>
        )}
        {node.arxiv_id && node.kind !== "center" && (
          <Button size="sm" onClick={add} disabled={adding || added}>
            {adding ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
            {added ? "Added" : "Add to library"}
          </Button>
        )}
      </div>
    </div>
  );
}
