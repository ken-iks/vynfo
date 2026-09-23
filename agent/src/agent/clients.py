import grpc

from proto.v1.inter.agent_backend import backend_pb2_grpc


class Clients:
    def __init__(self, backend_addr: str):
        self.backend_channel = grpc.insecure_channel(backend_addr)
        self.agent_backend_service = backend_pb2_grpc.AgentBackendServiceStub(
            self.backend_channel
        )

    def close(self):
        self.backend_channel.close()
