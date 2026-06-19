from typing import Sequence

from pydantic_ai import ModelMessage, ModelMessagesTypeAdapter, ModelRequest, ModelResponse, ToolCallPart, ToolReturnPart
import pydantic_core

from mensah.tools import resolve_tool_call
from proto.v1.inter.agent_runtime import chat_pb2

### Run parsers assist with parsing an agent run (Sequence[ModelMessage])
### for its various use cases within our harness

def serialize_run_messages(runs: Sequence[str]) -> list[ModelMessage]:
    """
    Converts a list of json strings that are the output of run.new_messages_json()
    for their corresponding runs, and converts and flattens them back into a list
    of ModelMessage's
    """
    return [
        message
        for run in runs
        for message in ModelMessagesTypeAdapter.validate_json(run)
    ]

def tool_returns_by_call_id(
    messages: Sequence[ModelMessage],
) -> dict[str, ToolReturnPart]:
    """
    Maps the tool returns of a run to their corresponding call ids, throwing if there exists any
    mismatch between tool call ids and their return ids (suggesting a malformed run)
    """
    tool_returns: dict[str, ToolReturnPart] = {}
    tool_call_ids: set[str] = set()

    for message in messages:
        if isinstance(message, ModelResponse):
            for part in message.parts:
                if isinstance(part, ToolCallPart):
                    if part.tool_call_id in tool_call_ids:
                        raise ValueError(f"Duplicate tool call id: {part.tool_call_id!r}")
                    tool_call_ids.add(part.tool_call_id)
        elif isinstance(message, ModelRequest):
            for part in message.parts:
                if isinstance(part, ToolReturnPart):
                    if part.tool_call_id in tool_returns:
                        raise ValueError(
                            f"Duplicate tool return id: {part.tool_call_id!r}"
                        )
                    tool_returns[part.tool_call_id] = part

    for tool_call_id in tool_returns:
        if tool_call_id not in tool_call_ids:
            raise ValueError(f"Orphaned tool return for tool call {tool_call_id!r}")

    return tool_returns

def parse_completed_tool_call(
    part: ToolCallPart, tool_returns: dict[str, ToolReturnPart]
) -> chat_pb2.CompletedToolCall:
    """
    Returns the corresponding CompletedToolCall object for a ToolCall request
    for which their exists the corresponding ToolReturn within the run - or
    throws if it doesn't exist
    """
    tool_return = tool_returns.get(part.tool_call_id)
    if tool_return is None:
        raise ValueError(f"Missing tool return for tool call {part.tool_call_id!r}")
    if tool_return.outcome != "success":
        raise ValueError(
            f"Unsupported tool return outcome {tool_return.outcome!r} "
            f"for tool call {part.tool_call_id!r}"
        )

    return chat_pb2.CompletedToolCall(
        call=resolve_tool_call(
            part.tool_name, part.args_as_dict(raise_if_invalid=True)
        ),
        call_return_json=pydantic_core.to_json(tool_return.content).decode(),
    )