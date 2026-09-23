import { conversationClient } from "@/lib/client";
import {
  AssistantRuntimeProvider,
  useRemoteThreadListRuntime,
  type AssistantRuntime,
  type RemoteThreadListAdapter,
  type ThreadMessage,
} from "@assistant-ui/react";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import { createAssistantStream } from "assistant-stream";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ThreadHistoryProvider } from "./ThreadHistoryProvider";

type PendingProject = {
  projectId?: string;
};

type AgentThreadListContextValue = {
  prepareNewThread: (projectId?: string) => void;
  preparedProjectId?: string;
};

const AgentThreadListContext =
  createContext<AgentThreadListContextValue | null>(null);

function createAdapter(
  onInitialize?: (conversationId: string) => void,
  getProjectIdForNewThread?: () => string | undefined,
): RemoteThreadListAdapter {
  return {
    unstable_Provider: ThreadHistoryProvider,
    async list() {
      const { conversations } = await conversationClient.listAIConversations(
        {},
      );
      if (!conversations) {
        throw new Error();
      }
      return {
        threads: conversations.map((t) => ({
          status: t.isArchived ? "archived" : "regular",
          remoteId: t.conversationId,
          externalId: t.projectId,
          title: t.title,
          custom: { projectId: t.projectId },
          lastMessageAt: t.lastUpdatedAt
            ? timestampDate(t.lastUpdatedAt)
            : undefined,
        })),
      };
    },
    async fetch(threadId: string) {
      // NOTE: threadId here refers to the remote ID and not the client id
      // its just poorly named
      const { conversation } = await conversationClient.getAIConversation({
        conversationId: threadId,
      });
      if (!conversation) {
        throw new Error();
      }
      return {
        status: conversation.isArchived ? "archived" : "regular",
        remoteId: conversation.conversationId,
        externalId: conversation.projectId,
        title: conversation.title,
        custom: { projectId: conversation.projectId },
        lastMessageAt: conversation.lastUpdatedAt
          ? timestampDate(conversation.lastUpdatedAt)
          : undefined,
      };
    },
    async initialize(threadId: string) {
      const projectId = getProjectIdForNewThread?.();
      const { conversation } = await conversationClient.createAIConversation({
        title: "New Conversation",
        clientId: threadId,
        projectId,
      });
      if (!conversation) {
        throw new Error();
      }
      onInitialize?.(conversation.conversationId);
      return { remoteId: conversation.conversationId, externalId: projectId };
    },
    async rename(remoteId: string, newTitle: string) {
      await conversationClient.updateAIConversation({
        conversationId: remoteId,
        title: newTitle,
      });
    },
    async generateTitle(
      remoteId: string,
      unstable_messages: readonly ThreadMessage[],
    ) {
      const { title } = await conversationClient.generateNewTitle({
        prompt: JSON.stringify({ unstable_messages }),
      });
      if (!title) {
        throw new Error();
      }
      await conversationClient.updateAIConversation({
        conversationId: remoteId,
        title: title,
      });
      return createAssistantStream(async (controller) => {
        controller.appendText(title);
      });
    },
    async archive(remoteId: string) {
      await conversationClient.updateAIConversation({
        conversationId: remoteId,
        archiveStatus: true,
      });
    },
    async unarchive(remoteId: string) {
      await conversationClient.updateAIConversation({
        conversationId: remoteId,
        archiveStatus: false,
      });
    },
    async delete(remoteId: string) {
      await conversationClient.deleteAIConversation({
        conversationId: remoteId,
      });
    },
  };
}

export function useAgentThreadList(): AgentThreadListContextValue {
  const context = useContext(AgentThreadListContext);
  if (!context) {
    throw new Error("useAgentThreadList must be used within ThreadProvider");
  }
  return context;
}

type ThreadProviderProps = {
  children: ReactNode;
  runtimeHook: () => AssistantRuntime;
  onInitialize?: (conversationId: string) => void;
  projectId?: string;
};

export function ThreadProvider({
  children,
  runtimeHook,
  onInitialize,
  projectId,
}: ThreadProviderProps) {
  const pendingProjectRef = useRef<PendingProject | undefined>(undefined);
  const [preparedProjectId, setPreparedProjectId] = useState<
    string | undefined
  >(projectId);
  const prepareNewThread = useCallback((projectId?: string) => {
    pendingProjectRef.current = { projectId };
    setPreparedProjectId(projectId);
  }, []);
  const getProjectIdForNewThread = useCallback(() => {
    const pendingProject = pendingProjectRef.current;
    pendingProjectRef.current = undefined;
    setPreparedProjectId(projectId);
    if (pendingProject) {
      return pendingProject.projectId;
    }
    return projectId;
  }, [projectId]);
  const threadListContextValue = useMemo(
    () => ({ prepareNewThread, preparedProjectId }),
    [prepareNewThread, preparedProjectId],
  );
  const adapter = useMemo(
    () => createAdapter(onInitialize, getProjectIdForNewThread),
    [getProjectIdForNewThread, onInitialize],
  );
  const runtime = useRemoteThreadListRuntime({
    adapter,
    runtimeHook,
  });
  return (
    <AgentThreadListContext.Provider value={threadListContextValue}>
      <AssistantRuntimeProvider runtime={runtime}>
        {children}
      </AssistantRuntimeProvider>
    </AgentThreadListContext.Provider>
  );
}
