import type { ToolWebSearch } from "@/gen/proto/v1/inter/agent_runtime/chat_pb";
import type { ToolCallMessagePart } from "@assistant-ui/react";

export function WebSearchTool(
  call: ToolWebSearch,
  toolCallId: string,
): ToolCallMessagePart<{ query: string }, unknown> {
  const args = { query: call.query };
  return {
    type: "tool-call",
    toolCallId,
    toolName: "webSearch",
    args,
    argsText: JSON.stringify(args),
  };
}
