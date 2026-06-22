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
import { useMemo, type ReactNode } from "react";
import { ThreadHistoryProvider } from "./ThreadHistoryProvider";

function createAdapter(
  onInitialize?: (conversationId: string) => void,
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
          title: t.title,
          lastMessageAt: t.lastUpdatedAt
            ? timestampDate(t.lastUpdatedAt)
            : undefined,
        })),
      };
    },
    async fetch(threadId: string) {
      // TODO: assert that threadId is referring to remote and not local
      const { conversation } = await conversationClient.getAIConversation({
        conversationId: threadId,
      });
      if (!conversation) {
        throw new Error();
      }
      return {
        status: conversation.isArchived ? "archived" : "regular",
        remoteId: conversation.conversationId,
        title: conversation.title,
        lastMessageAt: conversation.lastUpdatedAt
          ? timestampDate(conversation.lastUpdatedAt)
          : undefined,
      };
    },
    async initialize(threadId: string) {
      const { conversation } = await conversationClient.createAIConversation({
        title: "New Conversation",
        clientId: threadId,
      });
      if (!conversation) {
        throw new Error();
      }
      onInitialize?.(conversation.conversationId);
      return { remoteId: conversation.conversationId, externalId: undefined };
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
      // TODO: assert that I also have to make the backend call to update the title
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

type ThreadProviderProps = {
  children: ReactNode;
  runtimeHook: () => AssistantRuntime;
  onInitialize?: (conversationId: string) => void;
};

export function ThreadProvider({
  children,
  runtimeHook,
  onInitialize,
}: ThreadProviderProps) {
  const adapter = useMemo(() => createAdapter(onInitialize), [onInitialize]);
  const runtime = useRemoteThreadListRuntime({
    adapter,
    runtimeHook,
  });
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
