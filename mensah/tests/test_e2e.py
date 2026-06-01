from dotenv import load_dotenv
import pytest
from tavily import TavilyClient

from mensah.agent import VynfoAgentDeps
from tests.stubs import FakeServicerContext
from mensah.clients import Clients
from mensah.servicer import AgentRuntimeServicer
from proto.v1.inter.agent_runtime.chat_pb2 import StreamChatRequest


@pytest.fixture
def servicer():
    load_dotenv()
    return AgentRuntimeServicer(
        clients=Clients("localhost:50052"), deps=VynfoAgentDeps(TavilyClient())
    )


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
