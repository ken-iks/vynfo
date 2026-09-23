from dotenv import load_dotenv
import pytest
from tavily import TavilyClient
from unittest.mock import Mock

from agent.agent import VynfoAgentDeps
from tests.stubs import FakeServicerContext
from agent.clients import Clients
from agent.servicer import AgentRuntimeServicer
from proto.v1.inter.agent_backend.backend_pb2 import AuthenticateUserAndPromptResponse
from proto.v1.inter.agent_runtime.chat_pb2 import StreamChatRequest


@pytest.fixture
def servicer(monkeypatch: pytest.MonkeyPatch):
    load_dotenv()
    clients = Clients("localhost:50052")
    # we patch auth so that we can run the service uninterrupted without
    # a live user
    monkeypatch.setattr(
        clients.agent_backend_service,
        "AuthenticateUserAndPrompt",
        Mock(return_value=AuthenticateUserAndPromptResponse(valid=True)),
    )
    return AgentRuntimeServicer(clients=clients, deps=VynfoAgentDeps(TavilyClient()))


@pytest.fixture
def context():
    return FakeServicerContext()


@pytest.mark.asyncio
async def test_sending_prompt(
    servicer: AgentRuntimeServicer, context: FakeServicerContext
):
    responses = servicer.StreamChat(
        StreamChatRequest(prompt="Hi. How is it going"), context
    )
    async for response in responses:
        print(response)


@pytest.mark.asyncio
async def test_tool_use(servicer: AgentRuntimeServicer, context: FakeServicerContext):
    responses = servicer.StreamChat(
        StreamChatRequest(prompt="Tell me about Kenny Ikeji"), context
    )
    async for response in responses:
        print(response)
