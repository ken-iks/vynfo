package conversations

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/timestamppb"
	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"
)

func (c *ConversationServiceServer) GetAIConversation(
	ctx context.Context,
	req *connect.Request[v1.GetAIConversationRequest],
) (*connect.Response[v1.GetAIConversationResponse], error) {
	user, err := auth.RequireOnboardedUser(ctx, c.queries)
	if err != nil {
		return nil, err
	}
	conversationID, err := uuid.Parse(req.Msg.GetConversationId())
	if err != nil {
		slog.Error("error parsing conversation id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	conversation, err := c.queries.GetUserAIConversation(ctx, db.GetUserAIConversationParams{
		ID:                  conversationID,
		ConversationOwnerID: user.ID,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		slog.Error("error fetching ai conversation", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&v1.GetAIConversationResponse{
		Conversation: &v1.AIConversation{
			ConversationId:      conversation.ID.String(),
			Title:               conversation.Title,
			ConversationOwnerId: conversation.ConversationOwnerID.String(),
			LastUpdatedAt:       timestamppb.New(conversation.LastUpdatedAt),
		},
	}), nil
}
