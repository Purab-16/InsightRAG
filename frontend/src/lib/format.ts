export function shortTitle(title: string, max = 50): string {
  return title.length > max ? `${title.slice(0, max - 1).trimEnd()}…` : title;
}

/** "A. Author, B. Author" for up to two names, then "et al.". */
export function formatAuthors(authors: string[]): string {
  if (authors.length === 0) return "Unknown authors";
  if (authors.length <= 2) return authors.join(", ");
  return `${authors.slice(0, 2).join(", ")} et al.`;
}

export function formatLocalTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// New style 2310.06825 (optional version), old style cs/0112017 or hep-th/9901001.
const ARXIV_ID = /^(\d{4}\.\d{4,5}|[a-z-]+(\.[A-Z]{2})?\/\d{7})(v\d+)?$/;
const ARXIV_URL = /^https?:\/\/(www\.)?arxiv\.org\/(abs|pdf)\/.+/i;

/** Light client check. The backend does the real validation. */
export function looksLikeArxivId(value: string): boolean {
  const v = value.trim();
  return ARXIV_ID.test(v) || ARXIV_URL.test(v);
}
