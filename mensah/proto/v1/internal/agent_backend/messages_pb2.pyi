from proto.v1 import conversations_pb2 as _conversations_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class GetConversationMessagesRequest(_message.Message):
    __slots__ = ("conversation_id",)
    CONVERSATION_ID_FIELD_NUMBER: _ClassVar[int]
    conversation_id: str
    def __init__(self, conversation_id: _Optional[str] = ...) -> None: ...

class ConversationMessage(_message.Message):
    __slots__ = ("user_message", "agent_message")
    USER_MESSAGE_FIELD_NUMBER: _ClassVar[int]
    AGENT_MESSAGE_FIELD_NUMBER: _ClassVar[int]
    user_message: _conversations_pb2.UserMessage
    agent_message: _conversations_pb2.AgentMessage
    def __init__(self, user_message: _Optional[_Union[_conversations_pb2.UserMessage, _Mapping]] = ..., agent_message: _Optional[_Union[_conversations_pb2.AgentMessage, _Mapping]] = ...) -> None: ...

class GetConversationMessagesResponse(_message.Message):
    __slots__ = ("messages",)
    MESSAGES_FIELD_NUMBER: _ClassVar[int]
    messages: _containers.RepeatedCompositeFieldContainer[ConversationMessage]
    def __init__(self, messages: _Optional[_Iterable[_Union[ConversationMessage, _Mapping]]] = ...) -> None: ...
