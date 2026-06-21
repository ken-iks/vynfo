import type { ToolFetchWebPage } from "@/gen/proto/v1/inter/agent_runtime/chat_pb";
import type { ToolCallMessagePart } from "@assistant-ui/react";

export function PageFetchTool(
    call: ToolFetchWebPage,
    toolCallId: string,
): ToolCallMessagePart<{ urls: string[] }, unknown> {
    const args = { urls: call.urls };
    return {
        type: "tool-call",
        toolCallId,
        toolName: "pageFetch",
        args,
        argsText: JSON.stringify(args),
    }
}