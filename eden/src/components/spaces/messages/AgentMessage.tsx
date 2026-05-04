import type { SpaceMessageWithMetadata } from "@/gen/proto/v1/spaces_pb";
import { MessageBubble } from "./MessageBubble";

interface AgentMessageProps {
  message: SpaceMessageWithMetadata;
}

export function AgentMessage({ message }: AgentMessageProps) {
  return (
    <MessageBubble
      tone="agent"
      message={message}
      authorNameOverride="VynfoAgent"
    />
  );
}
