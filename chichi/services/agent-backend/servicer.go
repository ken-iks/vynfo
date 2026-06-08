package agentbackend

import (
	agentbackendpb "vynfo.com/vynfo/gen/proto/v1/inter/agent_backend"
	dbgen "vynfo.com/vynfo/internal/db"
)

type AgentBackendServiceServer struct {
	agentbackendpb.UnimplementedAgentBackendServiceServer
	queries *dbgen.Queries
}

func NewAgentBackServiceServer(queries *dbgen.Queries) *AgentBackendServiceServer {
	return &AgentBackendServiceServer{queries: queries}
}
