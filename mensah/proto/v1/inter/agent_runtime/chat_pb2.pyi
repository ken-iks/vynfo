from google.protobuf.internal import containers as _containers
from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class ToolCallStatus(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    TOOL_CALL_STATUS_UNSPECIFIED: _ClassVar[ToolCallStatus]
    TOOL_CALL_STATUS_REQUESTED: _ClassVar[ToolCallStatus]
    TOOL_CALL_STATUS_COMPLETE: _ClassVar[ToolCallStatus]
    TOOL_CALL_STATUS_DENIED: _ClassVar[ToolCallStatus]
    TOOL_CALL_STATUS_ERRORED: _ClassVar[ToolCallStatus]
TOOL_CALL_STATUS_UNSPECIFIED: ToolCallStatus
TOOL_CALL_STATUS_REQUESTED: ToolCallStatus
TOOL_CALL_STATUS_COMPLETE: ToolCallStatus
TOOL_CALL_STATUS_DENIED: ToolCallStatus
TOOL_CALL_STATUS_ERRORED: ToolCallStatus

class StreamChatRequest(_message.Message):
    __slots__ = ("prompt", "previous_conversation_messages", "user_id", "workspace_id")
    PROMPT_FIELD_NUMBER: _ClassVar[int]
    PREVIOUS_CONVERSATION_MESSAGES_FIELD_NUMBER: _ClassVar[int]
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    WORKSPACE_ID_FIELD_NUMBER: _ClassVar[int]
    prompt: str
    previous_conversation_messages: _containers.RepeatedScalarFieldContainer[str]
    user_id: str
    workspace_id: str
    def __init__(self, prompt: _Optional[str] = ..., previous_conversation_messages: _Optional[_Iterable[str]] = ..., user_id: _Optional[str] = ..., workspace_id: _Optional[str] = ...) -> None: ...

class StreamChatResponse(_message.Message):
    __slots__ = ("message_id", "text", "reasoning", "tool_call", "finished")
    MESSAGE_ID_FIELD_NUMBER: _ClassVar[int]
    TEXT_FIELD_NUMBER: _ClassVar[int]
    REASONING_FIELD_NUMBER: _ClassVar[int]
    TOOL_CALL_FIELD_NUMBER: _ClassVar[int]
    FINISHED_FIELD_NUMBER: _ClassVar[int]
    message_id: str
    text: TextDelta
    reasoning: ReasoningDelta
    tool_call: ToolCall
    finished: Finished
    def __init__(self, message_id: _Optional[str] = ..., text: _Optional[_Union[TextDelta, _Mapping]] = ..., reasoning: _Optional[_Union[ReasoningDelta, _Mapping]] = ..., tool_call: _Optional[_Union[ToolCall, _Mapping]] = ..., finished: _Optional[_Union[Finished, _Mapping]] = ...) -> None: ...

class TextDelta(_message.Message):
    __slots__ = ("content",)
    CONTENT_FIELD_NUMBER: _ClassVar[int]
    content: str
    def __init__(self, content: _Optional[str] = ...) -> None: ...

class ReasoningDelta(_message.Message):
    __slots__ = ("content",)
    CONTENT_FIELD_NUMBER: _ClassVar[int]
    content: str
    def __init__(self, content: _Optional[str] = ...) -> None: ...

class RunMetadata(_message.Message):
    __slots__ = ("input_tokens", "output_tokens", "reasoning_tokens", "num_provider_requests", "num_tool_calls")
    INPUT_TOKENS_FIELD_NUMBER: _ClassVar[int]
    OUTPUT_TOKENS_FIELD_NUMBER: _ClassVar[int]
    REASONING_TOKENS_FIELD_NUMBER: _ClassVar[int]
    NUM_PROVIDER_REQUESTS_FIELD_NUMBER: _ClassVar[int]
    NUM_TOOL_CALLS_FIELD_NUMBER: _ClassVar[int]
    input_tokens: int
    output_tokens: int
    reasoning_tokens: int
    num_provider_requests: int
    num_tool_calls: int
    def __init__(self, input_tokens: _Optional[int] = ..., output_tokens: _Optional[int] = ..., reasoning_tokens: _Optional[int] = ..., num_provider_requests: _Optional[int] = ..., num_tool_calls: _Optional[int] = ...) -> None: ...

class Finished(_message.Message):
    __slots__ = ("pydantic_new_messages_json", "run_metadata")
    PYDANTIC_NEW_MESSAGES_JSON_FIELD_NUMBER: _ClassVar[int]
    RUN_METADATA_FIELD_NUMBER: _ClassVar[int]
    pydantic_new_messages_json: str
    run_metadata: RunMetadata
    def __init__(self, pydantic_new_messages_json: _Optional[str] = ..., run_metadata: _Optional[_Union[RunMetadata, _Mapping]] = ...) -> None: ...

class ToolCall(_message.Message):
    __slots__ = ("status", "web_search", "page_fetch")
    STATUS_FIELD_NUMBER: _ClassVar[int]
    WEB_SEARCH_FIELD_NUMBER: _ClassVar[int]
    PAGE_FETCH_FIELD_NUMBER: _ClassVar[int]
    status: ToolCallStatus
    web_search: ToolWebSearch
    page_fetch: ToolFetchWebPage
    def __init__(self, status: _Optional[_Union[ToolCallStatus, str]] = ..., web_search: _Optional[_Union[ToolWebSearch, _Mapping]] = ..., page_fetch: _Optional[_Union[ToolFetchWebPage, _Mapping]] = ...) -> None: ...

class ToolWebSearch(_message.Message):
    __slots__ = ("query",)
    QUERY_FIELD_NUMBER: _ClassVar[int]
    query: str
    def __init__(self, query: _Optional[str] = ...) -> None: ...

class ToolFetchWebPage(_message.Message):
    __slots__ = ("urls",)
    URLS_FIELD_NUMBER: _ClassVar[int]
    urls: _containers.RepeatedScalarFieldContainer[str]
    def __init__(self, urls: _Optional[_Iterable[str]] = ...) -> None: ...
