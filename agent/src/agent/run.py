from pydantic_ai import (
    AgentRunResult,
    CompactionPart,
    FilePart,
    ModelRequest,
    ModelResponse,
    NativeToolCallPart,
    NativeToolReturnPart,
    RetryPromptPart,
    SystemPromptPart,
    TextPart,
    ThinkingPart,
    ToolCallPart,
    ToolReturnPart,
    UserPromptPart,
)

from agent.run_parse_helpers import parse_completed_tool_call, tool_returns_by_call_id
from proto.v1.inter.agent_runtime import chat_pb2


def parse_finished_run(result: AgentRunResult) -> list[chat_pb2.CompletedRunMessage]:
    messages = result.new_messages()
    tool_returns = tool_returns_by_call_id(messages)
    parsed_messages: list[chat_pb2.CompletedRunMessage] = []

    for message in messages:
        if isinstance(message, ModelRequest):
            parsed = _parse_model_request(message)
            if parsed is not None:
                parsed_messages.append(parsed)
        elif isinstance(message, ModelResponse):
            parsed_messages.append(_parse_model_response(message, tool_returns))

    return parsed_messages


def _parse_model_request(
    message: ModelRequest,
) -> chat_pb2.CompletedRunMessage | None:
    user_messages: list[chat_pb2.CompletedRunMessage] = []

    for part in message.parts:
        if isinstance(part, UserPromptPart):
            if not isinstance(part.content, str):
                raise ValueError(f"Unsupported user prompt content: {part.content!r}")
            user_messages.append(
                chat_pb2.CompletedRunMessage(
                    user=chat_pb2.UserMessage(content=part.content)
                )
            )
        elif isinstance(part, SystemPromptPart):
            pass
        elif isinstance(part, ToolReturnPart):
            pass
        elif isinstance(part, RetryPromptPart):
            pass
        else:
            pass

    if len(user_messages) > 1:
        raise ValueError(f"Expected at most one user prompt part: {message!r}")
    if user_messages:
        return user_messages[0]
    return None


def _parse_model_response(
    message: ModelResponse, tool_returns: dict[str, ToolReturnPart]
) -> chat_pb2.CompletedRunMessage:
    parts: list[chat_pb2.AssistantMessagePart] = []

    if message.state != "complete":
        raise ValueError(f"Unsupported incomplete model response: {message!r}")

    for part in message.parts:
        if isinstance(part, TextPart):
            parts.append(chat_pb2.AssistantMessagePart(text_regular=part.content))
        elif isinstance(part, ThinkingPart):
            if part.content:
                parts.append(chat_pb2.AssistantMessagePart(text_reasoning=part.content))
        elif isinstance(part, ToolCallPart):
            parts.append(
                chat_pb2.AssistantMessagePart(
                    tool_call=parse_completed_tool_call(part, tool_returns)
                )
            )
        elif isinstance(part, NativeToolCallPart):
            pass
        elif isinstance(part, NativeToolReturnPart):
            pass
        elif isinstance(part, CompactionPart):
            pass
        elif isinstance(part, FilePart):
            pass
        else:
            pass

    return chat_pb2.CompletedRunMessage(
        assistant=chat_pb2.AssistantMessage(parts=parts)
    )
