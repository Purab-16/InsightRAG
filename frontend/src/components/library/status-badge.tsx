import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PaperStatus } from "@/types/api";

const STEP_LABEL: Record<string, string> = {
  downloading: "Downloading",
  parsing: "Reading the PDF",
  chunking: "Splitting",
  embedding: "Indexing",
  insights: "Writing insights",
};

/** Text plus icon, never colour alone. The label stays in the text colour for contrast. */
export function StatusBadge({ status, step }: { status: PaperStatus; step?: string | null }) {
  if (status === "ready") {
    return (
      <Badge variant="outline" className="gap-1.5 rounded-full text-[13px] font-normal text-text">
        <CheckCircle2 className="size-3.5 text-success" aria-hidden /> Ready
      </Badge>
    );
  }
  if (status === "processing") {
    return (
      <Badge variant="outline" className="gap-1.5 rounded-full text-[13px] font-normal text-text">
        <Loader2 className="size-3.5 animate-spin text-warning motion-reduce:animate-none" aria-hidden />
        Processing{step && STEP_LABEL[step] ? `: ${STEP_LABEL[step]}` : ""}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1.5 rounded-full text-[13px] font-normal text-text">
      <AlertCircle className="size-3.5 text-danger" aria-hidden /> Failed
    </Badge>
  );
}
