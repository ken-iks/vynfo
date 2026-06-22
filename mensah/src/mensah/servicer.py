from uuid import uuid4
import grpc
from grpc.aio import ServicerContext
from pydantic_ai import Agent
from mensah.stream import parse_agent_stream_event
from mensah.clients import Clients
from mensah.agent import VynfoAgentDeps, get_vynfo_agent
from mensah.run_parse_helpers import serialize_run_messages
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
        is_valid = self.clients.agent_backend_service.AuthenticateUserAndPrompt(
            request=AuthenticateUserAndPromptRequest(
                user_id=request.user_id,
                workspace_id=request.workspace_id,
                prompt=request.prompt,
            )
        )
        if not is_valid:
            await context.abort(grpc.StatusCode.UNAUTHENTICATED, "unauthenticated")

        message_id = str(uuid4())
        if request.prompt is not None:
            tool_calls: dict[str, chat_pb2.ToolCall] = {}
            async with get_vynfo_agent().run_stream_events(
                request.prompt,
                message_history=serialize_run_messages(
                    request.previous_conversation_runs
                ),
                deps=self.deps,
            ) as stream:
                async for event in stream:
                    async for response in parse_agent_stream_event(
                        message_id, event, tool_calls
                    ):
                        yield response

    async def GenerateTitle(
        self,
        request: chat_pb2.GenerateTitleRequest,
        context: ServicerContext[
            chat_pb2.GenerateTitleRequest, chat_pb2.GenerateTitleResponse
        ],
    ):
        agent = Agent(
            "openai-responses:gpt-5.5",
            instructions="You are a conversation title generation agent."
            + " YOUR RESPONSE CANNOT EXCEED 3 WORDS. Generate a descriptive title"
            + " that captures the essence of the prompt input. DO NOT respond"
            + " to the prompt or add any extra commentary",
        )
        res = await agent.run(request.prompt)
        return chat_pb2.GenerateTitleResponse(title=res.output)
