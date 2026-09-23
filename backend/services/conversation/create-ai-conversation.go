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
	"vynfo.com/vynfo/shared"
)

func (c *ConversationServiceServer) CreateAIConversation(
	ctx context.Context,
	req *connect.Request[v1.CreateAIConversationRequest],
) (*connect.Response[v1.CreateAIConversationResponse], error) {
	user, err := auth.RequireOnboardedUser(ctx, c.queries)
	if err != nil {
		return nil, err
	}
	logger := slog.Default().With("user_id", user.ID.String())
	title := strings.TrimSpace(req.Msg.GetTitle())
	if title == "" {
		return nil, connect.NewError(
			connect.CodeInvalidArgument,
			errors.New("conversation title is required"),
		)
	}
	clientID := req.Msg.GetClientId()
	projectId := req.Msg.GetProjectId()

	projectIdPersisted := uuid.NullUUID{}
	if projectId != "" {
		projectUUID, err := shared.ParseUUID(ctx, logger, "projectId", projectId)
		if err != nil {
			return nil, err
		}
		projectIdPersisted = uuid.NullUUID{
			UUID:  projectUUID,
			Valid: true,
		}
	}

	conversation, err := c.queries.GetOrCreateAIConversation(
		ctx,
		db.GetOrCreateAIConversationParams{
			Title:               title,
			ConversationOwnerID: user.ID,
			ClientID: sql.NullString{
				String: clientID,
				Valid:  clientID != "",
			},
			ProjectID: projectIdPersisted,
		},
	)
	if err != nil {
		logger.ErrorContext(ctx, "error creating ai conversation", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	logger.InfoContext(
		ctx,
		"ai conversation created",
		"conversation_id",
		conversation.ID.String(),
		"has_client_id",
		clientID != "",
		"has_project_id",
		projectIdPersisted.Valid,
	)

	var maybeProjectID *string
	if conversation.ProjectID.Valid {
		projectIDValue := conversation.ProjectID.UUID.String()
		maybeProjectID = &projectIDValue
	}

	return connect.NewResponse(&v1.CreateAIConversationResponse{
		Conversation: &v1.AIConversation{
			ConversationId:      conversation.ID.String(),
			Title:               conversation.Title,
			ConversationOwnerId: conversation.ConversationOwnerID.String(),
			LastUpdatedAt:       timestamppb.New(conversation.LastUpdatedAt),
			ProjectId:           maybeProjectID,
		},
	}), nil
}
