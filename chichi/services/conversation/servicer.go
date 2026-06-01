package conversations

import (
	"database/sql"

	"cloud.google.com/go/storage"
	"vynfo.com/vynfo/gen/proto/v1/v1connect"
	dbgen "vynfo.com/vynfo/internal/db"
	agentruntime "vynfo.com/vynfo/gen/proto/v1/inter/agent_runtime"
)

type ConversationServiceServer struct {
	v1connect.UnimplementedConversationServiceHandler
	storageClient *storage.Client
	db *sql.DB
	queries *dbgen.Queries
	mensahClient agentruntime.ChatServiceClient
}

func NewConversationServiceServer(
	c *storage.Client,
	db *sql.DB,
	queries *dbgen.Queries,
	mensahClient agentruntime.ChatServiceClient,
) *ConversationServiceServer {
	return &ConversationServiceServer{
		storageClient: c,
		db: db,
		queries: queries,
		mensahClient: mensahClient,
	}
}