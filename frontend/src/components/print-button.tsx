"use client";

import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { printPage } from "@/lib/print";

/** "Export PDF": opens the print dialog with a clean, light layout. Hidden in the printout itself. */
export function PrintButton({ title }: { title: string }) {
  return (
    <Button variant="outline" size="sm" className="print:hidden" onClick={() => printPage(title)}>
      <FileDown aria-hidden /> Export PDF
    </Button>
  );
}
