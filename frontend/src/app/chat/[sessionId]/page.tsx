import { Suspense } from "react";
import { ChatSessionView } from "@/components/chat/chat-session-view";
import { Skeleton } from "@/components/ui/skeleton";

async function ChatRoute({ params }: { params: PageProps<"/chat/[sessionId]">["params"] }) {
  const { sessionId } = await params;
  return <ChatSessionView sessionId={sessionId} />;
}

export default function ChatPage({ params }: PageProps<"/chat/[sessionId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <ChatRoute params={params} />
    </Suspense>
  );
}
