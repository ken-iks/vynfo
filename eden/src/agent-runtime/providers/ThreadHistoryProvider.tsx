import { conversationClient } from "@/lib/client";
import { type ThreadHistoryAdapter, useAui, RuntimeAdapterProvider } from "@assistant-ui/react";
import { type ReactNode, useMemo } from "react";
import { toThreadMessages } from "../serde/toThreadMessages";


export function ThreadHistoryProvider({ children }: { children?: ReactNode }) {
    const aui = useAui();
    const history = useMemo<ThreadHistoryAdapter>(
        () => ({
            async load() {
                const { remoteId } = aui.threadListItem().getState();
                if (!remoteId) return { messages: [] };
                const { messages: conversationMessages } = await conversationClient.listAIConversationMessages({ conversationId: remoteId });
                if (!conversationMessages) {
                    throw new Error();
                }
                const messages = toThreadMessages(conversationMessages)
                return {
                    messages: messages.map((message, index) => ({
                        message,
                        // HACK: since we dont have message branching yet and
                        // dont return message ids from the api
                        parentId: index > 0 ? messages[index - 1]?.id ?? null : null
                    }))
                }
            },
            async append({ message, parentId }) {
                // TODO: unused args coz I dont need
                console.log(message, parentId);
                return;
            }
        }), [aui]
    )
    return (
        <RuntimeAdapterProvider adapters={{ history }}>
            {children}
        </RuntimeAdapterProvider>
    )
}