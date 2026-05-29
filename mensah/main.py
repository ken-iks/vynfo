from concurrent import futures
import os

import grpc

from clients import Clients
from proto.v1.internal.agent_runtime import chat_pb2_grpc
from agent_runtime.servicer import AgentRuntimeServicer


def main():
    mensah_addr = os.environ.get("MENSAH_GRPC_ADDR", "[::]:50051")
    chichi_addr = os.environ.get("CHICHI_GRPC_ADDR", "localhost:50052")

    clients = Clients(chichi_addr)
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))

    chat_pb2_grpc.add_ChatServiceServicer_to_server(
        AgentRuntimeServicer(clients),
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
