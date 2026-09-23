package conversations

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"strings"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/timestamppb"
	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"
)

func (c *ConversationServiceServer) UpdateAIConversation(
	ctx context.Context,
	req *connect.Request[v1.UpdateAIConversationRequest],
) (*connect.Response[v1.AIConversation], error) {
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
	title := strings.TrimSpace(req.Msg.GetTitle())
	if title == "" {
		return nil, connect.NewError(
			connect.CodeInvalidArgument,
			errors.New("conversation title is required"),
		)
	}

	conversation, err := c.queries.UpdateAIConversationTitle(
		ctx,
		db.UpdateAIConversationTitleParams{
			Title:               title,
			ID:                  conversationID,
			ConversationOwnerID: user.ID,
		},
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		logger.ErrorContext(ctx, "error updating ai conversation", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	logger.InfoContext(ctx, "ai conversation updated")

	return connect.NewResponse(&v1.AIConversation{
		ConversationId:      conversation.ID.String(),
		Title:               conversation.Title,
		ConversationOwnerId: conversation.ConversationOwnerID.String(),
		LastUpdatedAt:       timestamppb.New(conversation.LastUpdatedAt),
	}), nil
}
