import { useCallback, useEffect, useState } from "react";
import { instantiateSpaceWorker } from "./spaceWorker";
import { useAuthContext } from "../providers/AuthProvider";
import { spacesClient } from "@/lib/client";
import { auth } from "@/firebase";
import { create } from "@bufbuild/protobuf";
import {
  ListSpaceMessagesRequestSchema,
  SendSpaceMessageRequestSchema,
  type SpaceMessageWithMetadata,
} from "@/gen/proto/v1/spaces_pb";
import { AgentMessage } from "./messages/AgentMessage";
import { MessageInputBox } from "./messages/MessageInputBox";
import type { MessageInputValue } from "./hooks/useMessageInputEditor";
import { NonUserMessage } from "./messages/NonUserMessage";
import { UserMessage } from "./messages/UserMessage";

export function SpaceView({ spaceId }: { spaceId: string }) {
  const { userId, appUser } = useAuthContext();
  const [messages, setMessages] = useState<SpaceMessageWithMetadata[]>([]);
  const [sendError, setSendError] = useState("");
  const handleLoadMessages = useCallback(async () => {
    const request = create(ListSpaceMessagesRequestSchema, {
      spaceId,
    });
    const response = await spacesClient.listSpaceMessages(request);
    setMessages(response.messages);
  }, [spaceId]);

  const handleSubmitMessage = async (value: MessageInputValue) => {
    if (!appUser) {
      const err = new Error("No user selected");
      console.error("failed to send space message", err);
      setSendError(err.message);
      throw err;
    }

    setSendError("");
    try {
      const request = create(SendSpaceMessageRequestSchema, {
        spaceId,
        spaceMessage: {
          content: value.text,
        },
      });

      await spacesClient.sendSpaceMessage(request);
      await handleLoadMessages();
    } catch (err) {
      console.error("failed to send space message", err);
      setSendError(
        err instanceof Error ? err.message : "Failed to send message",
      );
      throw err;
    }
  };

  useEffect(() => {
    let worker: Worker | undefined;
    let cancelled = false;

    void handleLoadMessages();
    const startWorker = async () => {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken || cancelled) return;
      worker = instantiateSpaceWorker({ idToken, spaceId });
      worker.onmessage = async (event) => {
        // this function stays registered and runs every time
        // the worker sends a message
        if (event.data.kind == "reload") {
          await handleLoadMessages();
        }
      };
    };
    void startWorker();

    return () => {
      cancelled = true;
      worker?.terminate();
    };
  }, [handleLoadMessages, spaceId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {messages.map((message) => {
          if (message.spaceMessage?.author?.email === "VynfoAgent") {
            return <AgentMessage key={message.messageId} message={message} />;
          }

          if (message.spaceMessage?.author?.userId === userId) {
            return <UserMessage key={message.messageId} message={message} />;
          }

          return <NonUserMessage key={message.messageId} message={message} />;
        })}
      </div>
      <div className="mt-auto border-t bg-background p-4">
        {sendError && (
          <p className="mb-2 text-xs text-destructive">{sendError}</p>
        )}
        <MessageInputBox onSubmit={handleSubmitMessage} />
      </div>
    </div>
  );
}
