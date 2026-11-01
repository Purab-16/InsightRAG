// Mirrors backend/app/models.py (BACKEND_SCHEMA.md section 3). Keep both in sync.

export type PaperStatus = "processing" | "ready" | "failed";

export interface Insights {
  tldr: string;
  problem: string;
  method: string;
  datasets: string[];
  metrics: string[];
  key_results: string[];
  limitations: string[];
  contributions: string[];
  field: string;
}

export interface PaperSummary {
  id: string;
  title: string;
  authors: string[];
  source: "arxiv" | "upload";
  arxiv_id: string | null;
  status: PaperStatus;
  status_step: string | null;
  added_at: string;
  /** ISO date; null for uploads. Older backends may omit it. */
  published?: string | null;
}

export interface PaperDetail extends PaperSummary {
  abstract: string | null;
  categories: string[];
  chunk_count?: number | null;
  pdf_url: string | null;
  parse_source: "pdf" | "html" | null;
  error: string | null;
  insights: Insights | null;
}

export interface AddPaperResponse {
  paper_id: string;
  status: PaperStatus;
}

export interface ArxivResult {
  arxiv_id: string;
  title: string;
  authors: string[];
  abstract: string;
  published: string;
  categories: string[];
  in_library: boolean;
}

export interface Source {
  n: number;
  chunk_id: string;
  paper_id: string;
  paper_title: string;
  section: string | null;
  page: number | null;
  snippet: string;
  similarity: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: Source[] | null;
  created_at: string;
}

export interface Session {
  id: string;
  title: string | null;
  paper_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface SendMessageResponse {
  user_message: Message;
  assistant_message: Message;
}

export interface ComparePaper {
  paper_id: string;
  title: string;
  insights: Insights;
}

export interface CompareResponse {
  fields: string[];
  papers: ComparePaper[];
}

export interface GraphNode {
  id: string;
  label: string;
  year: number | null;
  citation_count: number | null;
  kind: "center" | "reference" | "citation";
  arxiv_id: string | null;
  url: string | null;
}

export interface GraphEdge {
  source: string; // cited
  target: string; // citing
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Usage {
  papers_used_today: number;
  papers_limit: number;
  messages_used_today: number;
  messages_limit: number;
  reset_at: string;
}

export type ErrorCode =
  | "invalid_input"
  | "unauthorized"
  | "not_found"
  | "not_ready"
  | "file_too_large"
  | "rate_limited"
  | "upstream_error";
