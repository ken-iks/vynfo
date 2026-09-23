import { conversationClient } from "@/lib/client";
import {
  type ThreadHistoryAdapter,
  useAui,
  RuntimeAdapterProvider,
} from "@assistant-ui/react";
import { type ReactNode, useMemo } from "react";
import { toThreadMessages } from "../serde/toThreadMessages";

export function ThreadHistoryProvider({ children }: { children?: ReactNode }) {
  const aui = useAui();
  const history = useMemo<ThreadHistoryAdapter>(
    () => ({
      async load() {
        const { remoteId } = aui.threadListItem().getState();
        if (!remoteId) return { messages: [] };
        const { messages: conversationMessages } =
          await conversationClient.listAIConversationMessages({
            conversationId: remoteId,
          });
        if (!conversationMessages) {
          throw new Error();
        }
        const messages = toThreadMessages(conversationMessages);
        return {
          headId: messages.at(-1)?.message.id ?? null,
          messages,
        };
      },
      async append() {
        return;
      },
    }),
    [aui],
  );
  return (
    <RuntimeAdapterProvider adapters={{ history }}>
      {children}
    </RuntimeAdapterProvider>
  );
}
