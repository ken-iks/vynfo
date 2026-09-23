import asyncio
import logging
import structlog
from structlog.stdlib import BoundLogger
import os

from dotenv import load_dotenv
import grpc.aio
from tavily import TavilyClient

from agent.agent import VynfoAgentDeps
from agent.clients import Clients
from proto.v1.inter.agent_runtime import chat_pb2_grpc
from agent.servicer import AgentRuntimeServicer


def configure_logging() -> None:
    logging.basicConfig(format="%(message)s", level=logging.INFO)

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            structlog.processors.JSONRenderer(),
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )


async def run_server():
    load_dotenv()
    configure_logging()

    logger: BoundLogger = structlog.get_logger(__name__)

    agent_addr = os.environ.get("AGENT_GRPC_ADDR", "[::]:50051")
    backend_addr = os.environ.get("BACKEND_GRPC_ADDR", "localhost:50052")

    clients = Clients(backend_addr)
    server = grpc.aio.server()
    deps = VynfoAgentDeps(search_client=TavilyClient())

    chat_pb2_grpc.add_ChatServiceServicer_to_server(
        AgentRuntimeServicer(clients, deps),
        server,
    )

    server.add_insecure_port(agent_addr)
    logger.info("Agent gRPC service listening", port=agent_addr)
    await server.start()

    try:
        await server.wait_for_termination()
    finally:
        logger.info("Server shutting down")
        clients.close()


def main():
    asyncio.run(run_server())


if __name__ == "__main__":
    main()
