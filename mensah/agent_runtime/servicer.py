from uuid import uuid4
from grpc.aio import ServicerContext
from tavily import TavilyClient
from agent_runtime.events import parse_agent_stream_event
from clients import Clients
from agent_runtime.agent import VynfoAgentDeps, vynfo_agent
from proto.v1.internal.agent_runtime import chat_pb2_grpc, chat_pb2
from pydantic_ai import Agent
from dotenv import load_dotenv

load_dotenv()

class AgentRuntimeServicer(chat_pb2_grpc.ChatServiceServicer):
    def __init__(self, clients: Clients):
        self.clients = clients

    async def StreamChat(
        self,
        request: chat_pb2.StreamChatRequest, 
        context: ServicerContext[chat_pb2.StreamChatRequest, chat_pb2.StreamChatResponse]
        ):
        deps = VynfoAgentDeps(
                search_client=TavilyClient()
            )
        message_id = str(uuid4())
        if request.prompt is not None:
            async with vynfo_agent.run_stream_events(request.prompt, deps=deps) as stream:
                async for event in stream:
                    yield parse_agent_stream_event(message_id, event)


       

