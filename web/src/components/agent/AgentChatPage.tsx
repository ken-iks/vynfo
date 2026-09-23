import { AgentRunTimeProvider } from "@/agent-runtime/providers/AgentRuntimeProvider";
import { Thread } from "@/components/assistant-ui/thread";
import { useWorkspaceContext } from "@/components/providers/WorkspaceProvider";
import { useBreadcrumbs } from "@/components/Breadcrumbs";
import { AgentChatList } from "./AgentChatList";

type AgentChatPageProps = {
  projectId?: string;
};

export function AgentChatPage({ projectId }: AgentChatPageProps) {
  const { loadingWorkspaces } = useWorkspaceContext();

  useBreadcrumbs([{ label: "Ask Murch" }]);

  if (loadingWorkspaces) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading workspace...
      </div>
    );
  }

  return (
    <AgentRunTimeProvider projectId={projectId}>
      <div className="flex h-[calc(100vh-3rem)] min-h-0 overflow-hidden">
        <AgentChatList />
        <div className="h-full min-h-0 min-w-0 flex-1">
          <Thread allowAttachments={false} />
        </div>
      </div>
    </AgentRunTimeProvider>
  );
}
