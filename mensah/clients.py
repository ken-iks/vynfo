import grpc

from proto.v1.internal.agent_backend import messages_pb2_grpc


class Clients:
    def __init__(self, chichi_addr: str):
        self.chichi_channel = grpc.insecure_channel(chichi_addr)
        self.conversation_service = messages_pb2_grpc.ConversationServiceStub(
            self.chichi_channel
        )

    def close(self):
        self.chichi_channel.close()