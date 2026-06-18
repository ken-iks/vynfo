from typing import Sequence
from pydantic import TypeAdapter
from pydantic_ai import ModelMessage

from pydantic_ai.ui.vercel_ai import VercelAIAdapter
from pydantic_ai.ui.vercel_ai.request_types import UIMessage

_ui_message_adapter = TypeAdapter(UIMessage)


def model_messages_to_ui_json_str(messages: list[ModelMessage]) -> list[str]:
    return [
        _ui_message_adapter.dump_json(m).decode()
        for m in VercelAIAdapter.dump_messages(messages)
    ]


def ui_json_str_to_model_messages(messages: Sequence[str]) -> list[ModelMessage]:
    return VercelAIAdapter.load_messages(
        [_ui_message_adapter.validate_json(m) for m in messages]
    )
