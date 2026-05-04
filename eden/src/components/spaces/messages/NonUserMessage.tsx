import type { SpaceMessageWithMetadata } from "@/gen/proto/v1/spaces_pb";
import { MessageBubble } from "./MessageBubble";

interface NonUserMessageProps {
  message: SpaceMessageWithMetadata;
  authorName?: string;
}

export function NonUserMessage({ message, authorName }: NonUserMessageProps) {
  return (
    <MessageBubble
      tone="nonUser"
      message={message}
      authorNameOverride={authorName}
    />
  );
}
