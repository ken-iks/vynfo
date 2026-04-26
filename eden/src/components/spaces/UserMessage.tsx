import type { SpaceMessageWithMetadata } from "@/gen/proto/v1/spaces_pb";
import { MessageBubble } from "./MessageBubble";

interface UserMessageProps {
  message: SpaceMessageWithMetadata;
  authorName?: string;
}

export function UserMessage({ message, authorName = "You" }: UserMessageProps) {
  return (
    <MessageBubble
      tone="user"
      message={message}
      authorNameOverride={authorName}
    />
  );
}
