import type { AIConversationMessageNode } from "@/gen/proto/v1/conversation_pb";
import type {
  AssistantMessage,
  AssistantMessagePart,
  UserMessage,
} from "@/gen/proto/v1/inter/agent_runtime/chat_pb";
import {
  type ThreadAssistantMessage,
  type ThreadAssistantMessagePart,
  type ThreadMessage,
  type ThreadUserMessage,
} from "@assistant-ui/react";
import { lookupToolArgs } from "../tools-registry/lookup";

interface ThreadMessageNode {
  message: ThreadMessage;
  parentId: string | null;
}

export function toThreadMessages(
  nodes: AIConversationMessageNode[],
): ThreadMessageNode[] {
  return nodes.map((node) => {
    const message = node.message;
    if (!message) {
      throw new Error(
        `conversation message node is missing message: ${node.clientId}`,
      );
    }
    switch (message.kind.case) {
      case "user":
        return {
          message: toThreadUserMessage(message.kind.value, node.clientId),
          parentId: node.parentClientId ?? null,
        };
      case "assistant":
        return {
          message: toThreadAssistantMessage(message.kind.value, node.clientId),
          parentId: node.parentClientId ?? null,
        };
      default:
        throw new Error(
          `unhandled completed run message kind: ${message.kind.case}`,
        );
    }
  });
}

function toThreadUserMessage(
  message: UserMessage,
  id: string,
): ThreadUserMessage {
  return {
    id,
    role: "user",
    content: [{ type: "text", text: message.content }],
    attachments: [],
    metadata: { custom: {} },
    createdAt: new Date(0),
  };
}

function toThreadAssistantMessage(
  message: AssistantMessage,
  id: string,
): ThreadAssistantMessage {
  return {
    id,
    role: "assistant",
    content: message.parts.map(toThreadAssistantMessagePart),
    status: { type: "complete", reason: "stop" },
    metadata: {
      unstable_state: null,
      unstable_annotations: [],
      unstable_data: [],
      steps: [],
      custom: {},
    },
    createdAt: new Date(0),
  };
}

function toThreadAssistantMessagePart(
  part: AssistantMessagePart,
): ThreadAssistantMessagePart {
  switch (part.content.case) {
    case "textReasoning":
      return { type: "reasoning", text: part.content.value };
    case "textRegular":
      return { type: "text", text: part.content.value };
    case "toolCall": {
      const call = part.content.value.call;
      if (!call) {
        throw new Error("completed tool call is missing call data");
      }
      return lookupToolArgs(
        call,
        part.content.value.toolCallId,
        parseToolResult(part.content.value.callReturnJson),
      );
    }
    case "imageUrl":
      return { type: "image", image: part.content.value };
    default:
      throw new Error(
        `unhandled assistant message part content: ${part.content.case}`,
      );
  }
}

function parseToolResult(result: string): unknown {
  if (!result) return undefined;
  return JSON.parse(result);
}
