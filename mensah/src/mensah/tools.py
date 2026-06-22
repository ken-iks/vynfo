from typing import Any

from pydantic_ai import ToolResultEvent, ToolReturnPart
import pydantic_core

from mensah.agent import FetchPageArgs, WebSearchArgs
from proto.v1.inter.agent_runtime import chat_pb2


def resolve_tool_call(name: str, args_as_dict: dict[str, Any]) -> chat_pb2.ToolCall:
    if name == "web_search":
        args = WebSearchArgs.model_validate(args_as_dict)
        return chat_pb2.ToolCall(web_search=chat_pb2.ToolWebSearch(query=args.query))
    elif name == "fetch_page":
        args = FetchPageArgs.model_validate(args_as_dict)
        return chat_pb2.ToolCall(page_fetch=chat_pb2.ToolFetchWebPage(urls=args.urls))
    else:
        raise ValueError(f"Unknown tool called: {name} with args {args_as_dict}")


def resolve_tool_result_status(event: ToolResultEvent) -> chat_pb2.ToolCallStatus:
    if isinstance(event.part, ToolReturnPart):
        if event.part.outcome == "success":
            return chat_pb2.TOOL_CALL_STATUS_COMPLETE
        if event.part.outcome == "denied":
            return chat_pb2.TOOL_CALL_STATUS_DENIED
    return chat_pb2.TOOL_CALL_STATUS_ERRORED


def resolve_tool_result_json(event: ToolResultEvent) -> str:
    if isinstance(event.part, ToolReturnPart):
        return pydantic_core.to_json(event.part.content).decode()
    return ""
