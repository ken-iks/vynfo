from typing import AsyncIterator
from pydantic_ai import (
    AgentRunResult,
    AgentRunResultEvent,
    AgentStreamEvent,
    ModelResponsePart,
    ModelResponsePartDelta,
    PartDeltaEvent,
    PartEndEvent,
    PartStartEvent,
    TextPart,
    TextPartDelta,
    ThinkingPart,
    ThinkingPartDelta,
    ToolCallPart,
    ToolResultEvent,
)

from mensah.run import parse_finished_run
from mensah.tools import (
    resolve_tool_call,
    resolve_tool_result_json,
    resolve_tool_result_status,
)
from proto.v1.inter.agent_runtime import chat_pb2


async def parse_agent_stream_event(
    message_id: str,
    event: AgentStreamEvent | AgentRunResultEvent,
    tool_calls: dict[str, chat_pb2.ToolCall],
) -> AsyncIterator[chat_pb2.StreamChatResponse]:
    if isinstance(event, AgentRunResultEvent):
        event_result: AgentRunResult = event.result
        usage = chat_pb2.RunMetadata(
            input_tokens=event_result.usage.input_tokens,
            output_tokens=event_result.usage.output_tokens,
            reasoning_tokens=event_result.usage.details["reasoning_tokens"],
            num_provider_requests=event_result.usage.requests,
            num_tool_calls=event_result.usage.tool_calls,
        )
        yield chat_pb2.StreamChatResponse(
            message_id=message_id,
            finished=chat_pb2.Finished(
                new_messages=parse_finished_run(event_result),
                run_metadata=usage,
                runtime_convertable_json_string=event_result.new_messages_json().decode(),
            ),
        )
    else:
        if isinstance(event, PartStartEvent):
            event_part: ModelResponsePart = event.part
            if isinstance(event_part, TextPart):
                yield chat_pb2.StreamChatResponse(
                    message_id=message_id,
                    text=chat_pb2.TextDelta(content=event_part.content),
                )
            elif isinstance(event_part, ThinkingPart):
                if event_part.content:
                    yield chat_pb2.StreamChatResponse(
                        message_id=message_id,
                        reasoning=chat_pb2.ReasoningDelta(content=event_part.content),
                    )
        elif isinstance(event, PartDeltaEvent):
            event_delta: ModelResponsePartDelta = event.delta
            if isinstance(event_delta, TextPartDelta):
                yield chat_pb2.StreamChatResponse(
                    message_id=message_id,
                    text=chat_pb2.TextDelta(content=event_delta.content_delta),
                )
            elif isinstance(event_delta, ThinkingPartDelta):
                if event_delta.content_delta:
                    yield chat_pb2.StreamChatResponse(
                        message_id=message_id,
                        reasoning=chat_pb2.ReasoningDelta(
                            content=event_delta.content_delta
                        ),
                    )
        elif isinstance(event, PartEndEvent):
            final_event_part: ModelResponsePart = event.part
            if isinstance(final_event_part, ToolCallPart):
                tool_call = resolve_tool_call(
                    final_event_part.tool_name,
                    final_event_part.args_as_dict(raise_if_invalid=True),
                )
                tool_calls[final_event_part.tool_call_id] = tool_call
                yield chat_pb2.StreamChatResponse(
                    message_id=message_id,
                    tool_call=chat_pb2.StreamingToolCall(
                        status=chat_pb2.TOOL_CALL_STATUS_REQUESTED,
                        call=tool_call,
                        tool_call_id=final_event_part.tool_call_id,
                    ),
                )
        elif isinstance(event, ToolResultEvent):
            tool_call = tool_calls.pop(event.tool_call_id, None)
            if tool_call is None:
                raise ValueError(f"Missing streamed tool call {event.tool_call_id!r}")

            yield chat_pb2.StreamChatResponse(
                message_id=message_id,
                tool_call=chat_pb2.StreamingToolCall(
                    status=resolve_tool_result_status(event),
                    call=tool_call,
                    call_return_json=resolve_tool_result_json(event),
                    tool_call_id=event.tool_call_id,
                ),
            )
