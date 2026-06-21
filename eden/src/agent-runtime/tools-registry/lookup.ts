import type { ToolCallMessagePart } from "@assistant-ui/react";
import { PageFetchTool } from "./tools/PageFetchTool";
import { WebSearchTool } from "./tools/WebSearchTool";
import type { ToolCall } from "@/gen/proto/v1/inter/agent_runtime/chat_pb";

export function lookupToolArgs(call: ToolCall, id: string, result?: unknown): ToolCallMessagePart {
    const attachResult = (part: ToolCallMessagePart): ToolCallMessagePart => {
        if (result === undefined) return part;
        return { ...part, result };
    }

    switch (call.kind.case) {
        case "pageFetch":
            return attachResult(PageFetchTool(call.kind.value, id));
        case "webSearch":
            return attachResult(WebSearchTool(call.kind.value, id));
        default:
            throw new Error(`unhandled tool call kind: ${call.kind.case}`)
    }
}