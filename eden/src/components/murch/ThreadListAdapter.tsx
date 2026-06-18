import { conversationClient } from "@/lib/client";
import { type ThreadHistoryAdapter, useAui, type RemoteThreadListAdapter } from "@assistant-ui/react";
import { useMemo } from "react";


const historyAdapter: RemoteThreadListAdapter = {
    unstable_Provider({ children }) {
        const aui = useAui();
        const history = useMemo<ThreadHistoryAdapter>(
            () => ({
                async load() {
                    const { remoteId } = aui.threadListItem().getState();
                    if (!remoteId) return { messages: [] };
                    const { uiMessages } = await conversationClient.listAIConversationMessages({ conversationId: remoteId });
                    if (!uiMessages) {
                        throw new Error();
                    }
                    return { messages: uiMessages.map(m => {
                        const parsed = JSON.parse(m);
                        // TODO: assistant ui doesnt actually support conversion from UIMessage to its ThreadMessage type
                        // best bet is to just define my own backend type interface for historical messages then. Then backend
                        // owns the message interface between both the agent runtime and the frontend... probably for the best
                        return AISDKMessageConverter.
                    }) }
                },
            })
        )
    }
}