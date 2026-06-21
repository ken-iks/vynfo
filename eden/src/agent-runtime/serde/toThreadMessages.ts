import type { AssistantMessage, AssistantMessagePart, CompletedRunMessage, UserMessage } from "@/gen/proto/v1/inter/agent_runtime/chat_pb";
import { generateId, type ThreadAssistantMessage, type ThreadAssistantMessagePart, type ThreadMessage, type ThreadUserMessage } from "@assistant-ui/react";
import { lookupToolArgs } from "../tools-registry/lookup";

export function toThreadMessages(messages: CompletedRunMessage[]): ThreadMessage[] {
    return messages.map(message => {
        const id = generateId();
        switch (message.kind.case) {
            case "user":
                return toThreadUserMessage(message.kind.value, id);
            case "assistant":
                return toThreadAssistantMessage(message.kind.value, id);
            default:
                throw new Error(`unhandled completed run message kind: ${message.kind.case}`);
        }
    })
}

function toThreadUserMessage(message: UserMessage, id: string): ThreadUserMessage {
    return {
        id,
        role: "user",
        content: [{type: "text", text:  message.content}],
        attachments: [],
        metadata: { custom: {} },
        createdAt: new Date(0)
    }
}

function toThreadAssistantMessage(message: AssistantMessage, id: string): ThreadAssistantMessage {
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
            custom: {}
        },
        createdAt: new Date(0)
    }
}

function toThreadAssistantMessagePart(part: AssistantMessagePart): ThreadAssistantMessagePart {
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
            return lookupToolArgs(call, part.content.value.toolCallId, parseToolResult(part.content.value.callReturnJson));
        }
        case "imageUrl":
            return { type: "image", image: part.content.value };
        default:
            throw new Error(`unhandled assistant message part content: ${part.content.case}`);
    }
}

function parseToolResult(result: string): unknown {
    if (!result) return undefined;
    return JSON.parse(result);
}