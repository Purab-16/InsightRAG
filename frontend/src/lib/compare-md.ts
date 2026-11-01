import type { CompareResponse, Insights } from "@/types/api";

const ROWS: { label: string; get: (i: Insights) => string | string[] }[] = [
  { label: "TL;DR", get: (i) => i.tldr },
  { label: "Problem", get: (i) => i.problem },
  { label: "Method", get: (i) => i.method },
  { label: "Datasets", get: (i) => i.datasets },
  { label: "Metrics", get: (i) => i.metrics },
  { label: "Key results", get: (i) => i.key_results },
  { label: "Limitations", get: (i) => i.limitations },
  { label: "Contributions", get: (i) => i.contributions },
];

const cell = (v: string | string[]) =>
  (Array.isArray(v) ? v.join("; ") : v).replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ").trim() || "None listed";

/** The comparison as a Markdown table, built in the browser from the data already on screen. */
export function compareToMarkdown(data: CompareResponse): string {
  const head = `| | ${data.papers.map((p) => cell(p.title)).join(" | ")} |`;
  const sep = `|---|${data.papers.map(() => "---").join("|")}|`;
  const body = ROWS.map((r) => `| **${r.label}** | ${data.papers.map((p) => cell(r.get(p.insights))).join(" | ")} |`);
  return ["# Paper comparison", "", head, sep, ...body, ""].join("\n");
}
