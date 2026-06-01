import grpc

from proto.v1.inter.agent_backend import backend_pb2_grpc


class Clients:
    def __init__(self, chichi_addr: str):
        self.chichi_channel = grpc.insecure_channel(chichi_addr)
        self.agent_backend_service = backend_pb2_grpc.AgentBackendServiceStub(
            self.chichi_channel
        )

    def close(self):
        self.chichi_channel.close()
