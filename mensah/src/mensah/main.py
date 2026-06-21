import asyncio
import os

from dotenv import load_dotenv
import grpc.aio
from tavily import TavilyClient

from mensah.agent import VynfoAgentDeps
from mensah.clients import Clients
from proto.v1.inter.agent_runtime import chat_pb2_grpc
from mensah.servicer import AgentRuntimeServicer


async def run_server():
    load_dotenv()

    mensah_addr = os.environ.get("MENSAH_GRPC_ADDR", "[::]:50051")
    chichi_addr = os.environ.get("CHICHI_GRPC_ADDR", "localhost:50052")

    clients = Clients(chichi_addr)
    server = grpc.aio.server()
    deps = VynfoAgentDeps(search_client=TavilyClient())

    chat_pb2_grpc.add_ChatServiceServicer_to_server(
        AgentRuntimeServicer(clients, deps),
        server,
    )

    server.add_insecure_port(mensah_addr)
    await server.start()
    print(f"Mensah gRPC service listening on {mensah_addr}", flush=True)

    try:
        await server.wait_for_termination()
    finally:
        clients.close()


def main():
    asyncio.run(run_server())


if __name__ == "__main__":
    main()
