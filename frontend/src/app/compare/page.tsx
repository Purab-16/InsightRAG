import { Suspense } from "react";
import { CompareView } from "@/components/compare/compare-view";
import { Skeleton } from "@/components/ui/skeleton";

export default function ComparePage() {
  // useSearchParams needs a Suspense boundary under Cache Components.
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <CompareView />
    </Suspense>
  );
}
