"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_MB = 20;

export function UploadDropzone({ onUpload }: { onUpload: (file: File) => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function handle(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are supported.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`PDF must be ${MAX_MB} MB or smaller.`);
      return;
    }
    setBusy(true);
    try {
      await onUpload(file);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void handle(e.dataTransfer.files[0]);
      }}
      className={cn("rounded-lg border border-dashed border-transparent", dragging && "border-primary bg-primary-soft")}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose a PDF to upload"
        onChange={(e) => void handle(e.target.files?.[0])}
      />
      <Button variant="outline" className="h-11 w-full bg-surface sm:w-auto" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
        {busy ? "Uploading…" : "Upload PDF"}
      </Button>
      <p className="mt-1.5 text-[13px] text-text-muted">PDF only · up to 20 MB · up to 100 pages · visible only to you</p>
    </div>
  );
}
