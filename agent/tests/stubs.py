from collections.abc import Iterable, Mapping
from typing import Any, NoReturn

import grpc
from grpc.aio import Metadata, ServicerContext

from proto.v1.inter.agent_runtime.chat_pb2 import StreamChatRequest, StreamChatResponse


def metadata_from(value: Any) -> Metadata:
    if isinstance(value, Metadata):
        return value
    return Metadata(*value)


class FakeServicerContext(ServicerContext[StreamChatRequest, StreamChatResponse]):
    def __init__(self):
        self.status_code: grpc.StatusCode | None = None
        self.status_details = ""
        self.sent_initial_metadata = Metadata()
        self.sent_trailing_metadata = Metadata()
        self.messages: list[StreamChatResponse] = []

    async def read(self) -> StreamChatRequest:
        return StreamChatRequest()

    async def write(self, message: StreamChatResponse) -> None:
        self.messages.append(message)

    async def send_initial_metadata(self, initial_metadata: Any) -> None:
        self.sent_initial_metadata = metadata_from(initial_metadata)

    async def abort(
        self,
        code: grpc.StatusCode,
        details: str = "",
        trailing_metadata: Any = (),
    ) -> NoReturn:
        self.status_code = code
        self.status_details = details
        self.sent_trailing_metadata = metadata_from(trailing_metadata)
        raise grpc.RpcError(details)

    def set_trailing_metadata(self, trailing_metadata: Any) -> None:
        self.sent_trailing_metadata = metadata_from(trailing_metadata)

    def invocation_metadata(self) -> Metadata | None:
        return None

    def set_code(self, code: grpc.StatusCode) -> None:
        self.status_code = code

    def set_details(self, details: str) -> None:
        self.status_details = details

    def set_compression(self, compression: grpc.Compression) -> None:
        return None

    def disable_next_message_compression(self) -> None:
        return None

    def peer(self) -> str:
        return "fake-peer"

    def peer_identities(self) -> Iterable[bytes] | None:
        return None

    def peer_identity_key(self) -> str | None:
        return None

    def auth_context(self) -> Mapping[str, Iterable[bytes]]:
        return {}
