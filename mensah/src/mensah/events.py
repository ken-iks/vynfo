from typing import Any, AsyncIterator
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
)

from mensah.agent import FetchPageArgs, WebSearchArgs
from mensah.history import model_messages_to_ui_json_str
from proto.v1.inter.agent_runtime import chat_pb2


async def parse_agent_stream_event(
    message_id: str, event: AgentStreamEvent | AgentRunResultEvent
) -> AsyncIterator[chat_pb2.StreamChatResponse]:
    if isinstance(event, AgentRunResultEvent):
        event_result: AgentRunResult = event.result
        # on finish, we list all of the new model messages (this includes the
        # sent message) as json strings, we can be re marshalled on load
        new_messages_json_strs = model_messages_to_ui_json_str(
            event_result.new_messages()
        )
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
                ui_messages_new=new_messages_json_strs, run_metadata=usage
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
                    chat_pb2.TOOL_CALL_STATUS_REQUESTED,
                )
                yield chat_pb2.StreamChatResponse(
                    message_id=message_id, tool_call=tool_call
                )


def resolve_tool_call(
    name: str, args_as_dict: dict[str, Any], status: chat_pb2.ToolCallStatus
) -> chat_pb2.ToolCall:
    if name == "web_search":
        args = WebSearchArgs.model_validate(args_as_dict)
        return chat_pb2.ToolCall(
            status=status, web_search=chat_pb2.ToolWebSearch(query=args.query)
        )
    elif name == "fetch_page":
        args = FetchPageArgs.model_validate(args_as_dict)
        return chat_pb2.ToolCall(
            status=status, page_fetch=chat_pb2.ToolFetchWebPage(urls=args.urls)
        )
    else:
        raise ValueError(f"Unknown tool called: {name} with args {args_as_dict}")
