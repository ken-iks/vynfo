package conversations

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"
)

func (c *ConversationServiceServer) ListAIConversationMessages(
	ctx context.Context,
	req *connect.Request[v1.ListAIConversationMessagesRequest],
) (*connect.Response[v1.ListAIConversationMessagesResponse], error) {
	user, err := auth.RequireOnboardedUser(ctx, c.queries)
	if err != nil {
		return nil, err
	}
	conversationID, err := uuid.Parse(req.Msg.GetConversationId())
	if err != nil {
		slog.Error("error parsing conversation id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	_, err = c.queries.GetUserAIConversation(ctx, db.GetUserAIConversationParams{
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

	rows, err := c.queries.ListAIConversationMessagesForConversation(ctx, conversationID)
	if err != nil {
		slog.Error("error fetching ai conversation messages", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	messages := make([]string, 0, len(rows))
	for _, row := range rows {
		messages = append(messages, row.MessageContentJsonString)
	}

	return connect.NewResponse(&v1.ListAIConversationMessagesResponse{
		UiMessages: messages,
	}), nil
}
