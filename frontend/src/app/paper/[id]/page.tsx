import { Suspense } from "react";
import { PaperView } from "@/components/paper/paper-view";
import { Skeleton } from "@/components/ui/skeleton";

async function PaperRoute({ params }: { params: PageProps<"/paper/[id]">["params"] }) {
  const { id } = await params;
  return <PaperView id={id} />;
}

export default function PaperPage({ params }: PageProps<"/paper/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <PaperRoute params={params} />
    </Suspense>
  );
}
