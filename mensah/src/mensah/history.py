from typing import Sequence
from pydantic import TypeAdapter
from pydantic_ai import ModelMessage


_model_message_adapter = TypeAdapter(ModelMessage)


def model_messages_to_json_str(messages: list[ModelMessage]) -> list[str]:
    return [_model_message_adapter.dump_json(m).decode() for m in messages]


def json_str_to_model_messages(messages: Sequence[str]) -> list[ModelMessage]:
    return [_model_message_adapter.validate_json(m) for m in messages]
