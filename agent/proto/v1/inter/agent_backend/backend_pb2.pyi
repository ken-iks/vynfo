from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Optional as _Optional

DESCRIPTOR: _descriptor.FileDescriptor

class AuthenticateUserAndPromptRequest(_message.Message):
    __slots__ = ("user_id", "workspace_id", "prompt")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    WORKSPACE_ID_FIELD_NUMBER: _ClassVar[int]
    PROMPT_FIELD_NUMBER: _ClassVar[int]
    user_id: str
    workspace_id: str
    prompt: str
    def __init__(
        self,
        user_id: _Optional[str] = ...,
        workspace_id: _Optional[str] = ...,
        prompt: _Optional[str] = ...,
    ) -> None: ...

class AuthenticateUserAndPromptResponse(_message.Message):
    __slots__ = ("valid",)
    VALID_FIELD_NUMBER: _ClassVar[int]
    valid: bool
    def __init__(self, valid: _Optional[bool] = ...) -> None: ...
