import { useWorkspaceContext } from "@/components/providers/WorkspaceProvider";
import { conversationStreamingClient } from "@/lib/client";
import { type ChatModelAdapter, useLocalRuntime } from "@assistant-ui/react";
import { useCallback, useRef, type ReactNode } from "react";
import { toThreadStream } from "../serde/toThreadStream";
import { ThreadProvider } from "./ThreadProvider";

type AgentRunTimeProviderProps = {
  children: ReactNode;
  projectId?: string;
};

export function AgentRunTimeProvider({
  children,
  projectId,
}: AgentRunTimeProviderProps) {
  const { currentWorkspaceId } = useWorkspaceContext();
  const initializedConversationIdRef = useRef<string | undefined>(undefined);
  const handleInitialize = useCallback((conversationId: string) => {
    initializedConversationIdRef.current = conversationId;
  }, []);
  const chatModel: ChatModelAdapter = {
    run({
      messages,
      abortSignal,
      unstable_threadId,
      unstable_parentId,
      unstable_assistantMessageId,
    }) {
      if (!currentWorkspaceId) {
        throw new Error("missing current workspace id");
      }
      const conversationId =
        unstable_threadId ?? initializedConversationIdRef.current;
      if (!conversationId) {
        throw new Error("missing conversation id");
      }
      const message = messages.at(-1);
      if (message?.role !== "user") {
        throw new Error("missing user text message");
      }
      const part = message.content[0];
      if (part?.type !== "text") {
        throw new Error("missing user text message");
      }
      // assistant-ui's unstable_parentId is the message id of the user
      // message being sent. Find it in the branch history and use the
      // previous message as that user message's persisted parent.
      const responseParentIndex = messages.findIndex(
        (candidate) => candidate.id === unstable_parentId,
      );
      const parentMessage =
        responseParentIndex > 0 ? messages[responseParentIndex - 1] : undefined;
      const stream = conversationStreamingClient.sendAgentMessage(
        {
          content: part.text,
          workspaceId: currentWorkspaceId,
          conversationId,
          persistanceOptions: {
            parentClientId: parentMessage?.id,
            clientId: message.id,
            responseClientId: unstable_assistantMessageId,
          },
        },
        { signal: abortSignal },
      );
      return toThreadStream(stream);
    },
  };

  function RuntimeHook() {
    return useLocalRuntime(chatModel);
  }

  return (
    <ThreadProvider
      runtimeHook={RuntimeHook}
      onInitialize={handleInitialize}
      projectId={projectId}
    >
      {children}
    </ThreadProvider>
  );
}
