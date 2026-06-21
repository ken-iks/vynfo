import { useWorkspaceContext } from "@/components/providers/WorkspaceProvider";
import { conversationClient } from "@/lib/client";
import { type ChatModelAdapter, useLocalRuntime } from "@assistant-ui/react";
import { useCallback, useRef, type ReactNode } from "react";
import { toThreadStream } from "../serde/toThreadStream";
import { ThreadProvider } from "./ThreadProvider";

export function AgentRunTimeProvider({ children }: { children: ReactNode }) {
    const { currentWorkspaceId } = useWorkspaceContext();
    const initializedConversationIdRef = useRef<string | undefined>(undefined);
    const handleInitialize = useCallback((conversationId: string) => {
        initializedConversationIdRef.current = conversationId;
    }, []);
    const chatModel: ChatModelAdapter = {
        run({ messages, abortSignal, unstable_threadId }) {
            if (!currentWorkspaceId) {
                throw new Error("missing current workspace id");
            }
            const conversationId = unstable_threadId ?? initializedConversationIdRef.current;
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
            const stream = conversationClient.sendAgentMessage({
                content: part.text,
                workspaceId: currentWorkspaceId,
                conversationId,
            }, { signal: abortSignal });
            return toThreadStream(stream);
        },
    };

    function RuntimeHook() {
        return useLocalRuntime(chatModel);
    }

    return (
        <ThreadProvider runtimeHook={RuntimeHook} onInitialize={handleInitialize}>
            {children}
        </ThreadProvider>
    );
}
