import type { StreamChatResponse, StreamingToolCall } from "@/gen/proto/v1/inter/agent_runtime/chat_pb";
import { ToolCallStatus } from "@/gen/proto/v1/inter/agent_runtime/chat_pb";
import { type ChatModelRunResult, type ThreadAssistantMessagePart } from "@assistant-ui/react";
import { lookupToolArgs } from "../tools-registry/lookup";

export async function* toThreadStream(
    stream: AsyncIterable<StreamChatResponse>,
): AsyncGenerator<ChatModelRunResult, void, unknown> {
    let content: ThreadAssistantMessagePart[] = [];

    for await (const chunk of stream) {
        switch (chunk.body.case) {
            case "text":
                content = appendText(content, chunk.body.value.content);
                yield { content };
                break;
            case "reasoning":
                content = appendReasoning(content, chunk.body.value.content);
                yield { content };
                break;
            case "toolCall":
                content = appendToolCall(content, chunk.body.value);
                yield { content };
                break;
            case "finished":
                yield { status: { type: "complete", reason: "stop" } };
                break;
            default:
                throw new Error(`unhandled stream chat response body: ${chunk.body.case}`);
        }
    }
}

function appendText(content: ThreadAssistantMessagePart[], delta: string): ThreadAssistantMessagePart[] {
    const last = content.at(-1);
    if (last?.type === "text") {
        return [
            ...content.slice(0, -1),
            { type: "text", text: last.text + delta },
        ];
    }
    return [...content, { type: "text", text: delta }];
}

function appendReasoning(content: ThreadAssistantMessagePart[], delta: string): ThreadAssistantMessagePart[] {
    const last = content.at(-1);
    if (last?.type === "reasoning") {
        return [
            ...content.slice(0, -1),
            { type: "reasoning", text: last.text + delta },
        ];
    }
    return [...content, { type: "reasoning", text: delta }];
}

function appendToolCall(
    content: ThreadAssistantMessagePart[],
    toolCall: StreamingToolCall,
): ThreadAssistantMessagePart[] {
    if (!toolCall.call) {
        throw new Error("streaming tool call is missing call data");
    }

    const next = lookupToolArgs(
        toolCall.call,
        toolCall.toolCallId,
        parseToolResult(toolCall.callReturnJson),
    );
    const part = toolCall.status === ToolCallStatus.DENIED || toolCall.status === ToolCallStatus.ERRORED
        ? { ...next, isError: true }
        : next;

    const existingIndex = content.findIndex(
        (existing) => existing.type === "tool-call" && existing.toolCallId === part.toolCallId,
    );
    if (existingIndex !== -1) {
        return content.map((existing, index) => index === existingIndex ? part : existing);
    }
    return [...content, part];
}

function parseToolResult(result: string | undefined): unknown {
    if (!result) return undefined;
    return JSON.parse(result);
}
