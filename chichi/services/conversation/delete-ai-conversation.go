package conversations

import (
	"context"
	"database/sql"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/emptypb"
	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"
)

func (c *ConversationServiceServer) DeleteAIConversation(
	ctx context.Context,
	req *connect.Request[v1.DeleteAIConversationRequest],
) (*connect.Response[emptypb.Empty], error) {
	user, err := auth.RequireOnboardedUser(ctx, c.queries)
	if err != nil {
		return nil, err
	}
	logger := slog.Default().With("user_id", user.ID.String())
	conversationID, err := uuid.Parse(req.Msg.GetConversationId())
	if err != nil {
		logger.ErrorContext(ctx, "error parsing conversation id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	logger = logger.With("conversation_id", conversationID.String())

	deletedRows, err := c.queries.DeleteAIConversation(ctx, db.DeleteAIConversationParams{
		ID:                  conversationID,
		ConversationOwnerID: user.ID,
	})
	if err != nil {
		logger.ErrorContext(ctx, "error deleting ai conversation", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if deletedRows == 0 {
		return nil, connect.NewError(connect.CodeNotFound, sql.ErrNoRows)
	}
	logger.InfoContext(ctx, "ai conversation deleted")

	return connect.NewResponse(&emptypb.Empty{}), nil
}
