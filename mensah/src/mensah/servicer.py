from uuid import uuid4
from grpc.aio import ServicerContext
from tavily import TavilyClient
from mensah.events import parse_agent_stream_event
from mensah.clients import Clients
from mensah.agent import VynfoAgentDeps, get_vynfo_agent
from proto.v1.inter.agent_backend.backend_pb2 import AuthenticateUserAndPromptRequest
from proto.v1.inter.agent_runtime import chat_pb2_grpc, chat_pb2


class AgentRuntimeServicer(chat_pb2_grpc.ChatServiceServicer):
    def __init__(self, clients: Clients, deps: VynfoAgentDeps):
        self.clients = clients
        self.deps = deps

    async def StreamChat(
        self,
        request: chat_pb2.StreamChatRequest,
        context: ServicerContext[
            chat_pb2.StreamChatRequest, chat_pb2.StreamChatResponse
        ],
    ):
        # assert we can send the prompt:
        # is_valid = self.clients.agent_backend_service.AuthenticateUserAndPrompt(request=AuthenticateUserAndPromptRequest(user_id=request.user_id, workspace_id=request.workspace_id, prompt=request.prompt))

        message_id = str(uuid4())
        if request.prompt is not None:
            async with get_vynfo_agent().run_stream_events(
                request.prompt, deps=self.deps
            ) as stream:
                async for event in stream:
                    async for response in parse_agent_stream_event(message_id, event):
                        yield response
