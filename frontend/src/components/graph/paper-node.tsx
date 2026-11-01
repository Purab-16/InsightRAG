"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { NODE_HEIGHT, type PaperFlowNode } from "@/components/graph/layout";

export const KIND_LABEL = { center: "This paper", reference: "Reference", citation: "Cites this paper" } as const;

const KIND_STYLE = {
  center: "border-primary bg-primary text-primary-foreground",
  reference: "border-graph-ref bg-surface text-text",
  citation: "border-graph-cite bg-surface text-text",
} as const;

export function truncate(text: string, max = 40): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Colour comes from the border and the kind label, so the node is readable without it. */
export function PaperNode({ data }: NodeProps<PaperFlowNode>) {
  const { node, width, selected, recency } = data;
  // Older papers get a softer border (55% to 100% of the kind colour). The year is also printed, so this is a hint only.
  const base = node.kind === "reference" ? "var(--graph-ref)" : node.kind === "citation" ? "var(--graph-cite)" : null;
  const borderColor = base ? `color-mix(in srgb, ${base} ${Math.round(55 + 45 * recency)}%, transparent)` : undefined;
  return (
    <div
      style={{ width, height: NODE_HEIGHT, borderColor }}
      title={node.label}
      aria-label={`${KIND_LABEL[node.kind]}: ${node.label}${node.year ? `, ${node.year}` : ""}`}
      className={cn(
        "flex cursor-pointer flex-col justify-center rounded-xl border-2 px-2.5 text-[12px] leading-tight shadow-sm",
        KIND_STYLE[node.kind],
        selected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
      )}
    >
      <Handle type="target" position={Position.Left} className="!opacity-0" isConnectable={false} />
      <span className="font-medium">{truncate(node.label)}</span>
      <span className="opacity-80">{node.year ?? "Year unknown"}</span>
      <Handle type="source" position={Position.Right} className="!opacity-0" isConnectable={false} />
    </div>
  );
}
