"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api";

interface Props {
  label?: string;
  /** Starts the download. Rejects with an ApiError on failure. */
  onExport: () => Promise<void>;
}

export function ExportButton({ label = "Export .md", onExport }: Props) {
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      await onExport();
      toast.success("Downloaded.");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" size="sm" className="print:hidden" onClick={run} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
      {label}
    </Button>
  );
}
