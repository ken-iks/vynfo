package conversations

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"google.golang.org/protobuf/encoding/protojson"
	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/gen/proto/v1/inter/agent_runtime"
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
	messages := make([]*agent_runtime.CompletedRunMessage, 0, len(rows))
	for i, row := range rows {
		if err := protojson.Unmarshal(row.MessageContentAsJson, messages[i]); err != nil {
			slog.Error("error parsing message in db")
			return nil, connect.NewError(connect.CodeInternal, err)
		}
	}

	return connect.NewResponse(&v1.ListAIConversationMessagesResponse{
		Messages: messages,
	}), nil
}
