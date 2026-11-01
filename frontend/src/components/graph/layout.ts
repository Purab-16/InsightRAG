import { graphlib, layout } from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";
import type { GraphEdge, GraphNode } from "@/types/api";

export const NODE_HEIGHT = 62;

export type PaperNodeData = {
  node: GraphNode;
  width: number;
  selected: boolean;
  /** 0 (oldest shown) to 1 (newest shown). Drives how strong the border colour is. */
  recency: number;
} & Record<string, unknown>;

/** Maps a year onto 0..1 within the years present. No year, or all the same year, counts as 1. */
function recencyOf(year: number | null, min: number, max: number): number {
  if (year === null || max === min) return 1;
  return (year - min) / (max - min);
}

export type PaperFlowNode = Node<PaperNodeData, "paper">;

/** Node width grows with log(citation count): 140 px at none, 220 px at 100k or more. */
export function nodeWidth(citations: number | null): number {
  const t = Math.min(1, Math.log10((citations ?? 0) + 1) / 5);
  return Math.round(140 + 80 * t);
}

/** Left-to-right dagre layout. Edges point cited to citing, so references land left and citations right. */
export function layoutGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  selectedId: string | null,
): { nodes: PaperFlowNode[]; edges: Edge[] } {
  const g = new graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 12, ranksep: 110 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of nodes) g.setNode(n.id, { width: nodeWidth(n.citation_count), height: NODE_HEIGHT });
  for (const e of edges) g.setEdge(e.source, e.target);
  layout(g);

  const years = nodes.map((n) => n.year).filter((y): y is number => y !== null);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);

  return {
    nodes: nodes.map((n) => {
      const { x, y, width } = g.node(n.id);
      return {
        id: n.id,
        type: "paper",
        // dagre positions are node centres; React Flow wants the top-left corner.
        position: { x: x - width / 2, y: y - NODE_HEIGHT / 2 },
        data: { node: n, width, selected: n.id === selectedId, recency: recencyOf(n.year, minYear, maxYear) },
        draggable: false,
      };
    }),
    edges: edges.map((e) => ({ id: `${e.source}->${e.target}`, source: e.source, target: e.target })),
  };
}
