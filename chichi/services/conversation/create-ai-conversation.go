package conversations

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"strings"

	"connectrpc.com/connect"
	"google.golang.org/protobuf/types/known/timestamppb"
	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"
)

func (c *ConversationServiceServer) CreateAIConversation(
	ctx context.Context,
	req *connect.Request[v1.CreateAIConversationRequest],
) (*connect.Response[v1.CreateAIConversationResponse], error) {
	user, err := auth.RequireOnboardedUser(ctx, c.queries)
	if err != nil {
		return nil, err
	}
	title := strings.TrimSpace(req.Msg.GetTitle())
	if title == "" {
		return nil, connect.NewError(
			connect.CodeInvalidArgument,
			errors.New("conversation title is required"),
		)
	}
	clientID := req.Msg.GetClientId()

	conversation, err := c.queries.GetOrCreateAIConversation(
		ctx,
		db.GetOrCreateAIConversationParams{
			Title:               title,
			ConversationOwnerID: user.ID,
			ClientID: sql.NullString{
				String: clientID,
				Valid:  clientID != "",
			},
		},
	)
	if err != nil {
		slog.Error("error creating ai conversation", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&v1.CreateAIConversationResponse{
		Conversation: &v1.AIConversation{
			ConversationId:      conversation.ID.String(),
			Title:               conversation.Title,
			ConversationOwnerId: conversation.ConversationOwnerID.String(),
			LastUpdatedAt:       timestamppb.New(conversation.LastUpdatedAt),
		},
	}), nil
}
