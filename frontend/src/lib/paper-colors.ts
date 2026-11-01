// Five stable paper colours, all taken from the existing tokens in globals.css (no new colours).
const PAPER_COLORS = [
  "var(--primary)",
  "var(--graph-ref)",
  "var(--graph-cite)",
  "var(--success)",
  "var(--warning)",
];

/** Colour for the paper at this position in a chat. Pair it with a letter so colour is never the only cue. */
export function paperColor(index: number): string {
  return PAPER_COLORS[index % PAPER_COLORS.length];
}

export function paperLetter(index: number): string {
  return String.fromCharCode(65 + (index % 26));
}

/** "paper-title" style file name for downloads. */
export function fileSlug(text: string, fallback = "export"): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || fallback;
}
