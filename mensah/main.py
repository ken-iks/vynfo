from concurrent import futures
import os

from dotenv import load_dotenv
import grpc
from tavily import TavilyClient

from mensah.agent import VynfoAgentDeps
from mensah.clients import Clients
from proto.v1.inter.agent_runtime import chat_pb2_grpc
from mensah.servicer import AgentRuntimeServicer


def main():
    load_dotenv()

    mensah_addr = os.environ.get("MENSAH_GRPC_ADDR", "[::]:50051")
    chichi_addr = os.environ.get("CHICHI_GRPC_ADDR", "localhost:50052")

    clients = Clients(chichi_addr)
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    deps = VynfoAgentDeps(search_client=TavilyClient())

    chat_pb2_grpc.add_ChatServiceServicer_to_server(
        AgentRuntimeServicer(clients, deps),
        server,
    )

    server.add_insecure_port(mensah_addr)
    server.start()

    try:
        server.wait_for_termination()
    finally:
        clients.close()


if __name__ == "__main__":
    main()
