import type { PaperDetail } from "@/types/api";

const ESCAPE: Record<string, string> = { "\\": "\\\\", "{": "\\{", "}": "\\}", "&": "\\&", "%": "\\%", "#": "\\#", _: "\\_" };

function esc(text: string): string {
  return text.replace(/[\\{}&%#_]/g, (c) => ESCAPE[c]);
}

/** BibTeX entry built from the metadata we already store. Uploads have no year or arXiv ID, so those lines are left out. */
export function toBibtex(paper: Pick<PaperDetail, "title" | "authors" | "published" | "arxiv_id" | "id">): string {
  const year = paper.published?.slice(0, 4);
  const surname = (paper.authors[0]?.split(" ").pop() ?? "paper").toLowerCase().replace(/[^a-z]/g, "") || "paper";
  const key = `${surname}${year ?? ""}${paper.arxiv_id ? paper.arxiv_id.replace(/\W/g, "") : paper.id.slice(0, 6)}`;
  const lines = [
    `  title = {${esc(paper.title)}}`,
    paper.authors.length ? `  author = {${paper.authors.map(esc).join(" and ")}}` : null,
    year ? `  year = {${year}}` : null,
    paper.arxiv_id ? `  eprint = {${paper.arxiv_id}}` : null,
    paper.arxiv_id ? `  archivePrefix = {arXiv}` : null,
    paper.arxiv_id ? `  url = {https://arxiv.org/abs/${paper.arxiv_id}}` : null,
  ].filter(Boolean);
  return `@misc{${key},\n${lines.join(",\n")}\n}`;
}
