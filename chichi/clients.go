package main

import (
	"log/slog"
	"os"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	agentruntime "vynfo.com/vynfo/gen/proto/v1/inter/agent_runtime"
)

type VynfoClients struct {
	Mensah agentruntime.ChatServiceClient
}

func InitMensah() (agentruntime.ChatServiceClient, error) {
	addr := os.Getenv("MENSAH_GRPC_ADDR")
	if addr == "" {
		addr = "localhost:50051"
	}
	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		slog.Error(
			"could not connect to mensah client. check if python service is running",
			"port",
			addr,
			"error",
			err,
		)
		return nil, err
	}
	return agentruntime.NewChatServiceClient(conn), nil
}

func InitiateClients() (*VynfoClients, error) {
	mensahClient, err := InitMensah()
	if err != nil {
		return nil, err
	}
	return &VynfoClients{Mensah: mensahClient}, nil
}
