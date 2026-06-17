package conversations

import (
	"context"
	"log/slog"

	"connectrpc.com/connect"
	"google.golang.org/protobuf/types/known/timestamppb"
	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
)

func (c *ConversationServiceServer) ListAIConversations(
	ctx context.Context,
	req *connect.Request[v1.ListAIConversationsRequest],
) (*connect.Response[v1.ListAIConversationsResponse], error) {
	user, err := auth.RequireOnboardedUser(ctx, c.queries)
	if err != nil {
		return nil, err
	}

	rows, err := c.queries.ListUserAIConversations(ctx, user.ID)
	if err != nil {
		slog.Error("error listing ai conversations", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	conversations := make([]*v1.AIConversation, 0, len(rows))
	for _, row := range rows {
		conversations = append(conversations, &v1.AIConversation{
			ConversationId:      row.ID.String(),
			Title:               row.Title,
			ConversationOwnerId: row.ConversationOwnerID.String(),
			LastUpdatedAt:       timestamppb.New(row.LastUpdatedAt),
		})
	}

	return connect.NewResponse(&v1.ListAIConversationsResponse{
		Conversations: conversations,
	}), nil
}
