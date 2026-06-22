package conversations

import (
	"context"
	"io"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"google.golang.org/protobuf/encoding/protojson"
	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/gen/proto/v1/inter/agent_runtime"
	"vynfo.com/vynfo/internal/db"
)

func (c *ConversationServiceServer) SendAgentMessage(
	ctx context.Context,
	req *connect.Request[v1.SendAgentMessageRequest],
	stream *connect.ServerStream[agent_runtime.StreamChatResponse],
) error {
	onboardedUser, err := auth.RequireOnboardedUser(ctx, c.queries)
	if err != nil {
		return connect.NewError(connect.CodeUnauthenticated, err)
	}
	userId := onboardedUser.ID.String()
	userUUID, err := uuid.Parse(userId)
	if err != nil {
		return connect.NewError(connect.CodeInvalidArgument, err)
	}
	conversationUUID, err := uuid.Parse(req.Msg.GetConversationId())
	if err != nil {
		return connect.NewError(connect.CodeInvalidArgument, err)
	}

	resp, err := c.queries.AssertConversationUser(ctx, db.AssertConversationUserParams{
		ConversationOwnerID: userUUID,
		ID:                  conversationUUID,
	})

	if err != nil {
		return connect.NewError(connect.CodeInternal, err)
	}
	if !resp {
		return connect.NewError(connect.CodeUnauthenticated, err)
	}
	persistanceOptions := req.Msg.GetPersistanceOptions()
	parentID := uuid.NullUUID{}
	if persistanceOptions != nil && persistanceOptions.ParentClientId != nil {
		parentMessage, err := c.queries.GetAIConversationMessageForConversation(
			ctx,
			db.GetAIConversationMessageForConversationParams{
				ClientID:       persistanceOptions.GetParentClientId(),
				ConversationID: conversationUUID,
			},
		)
		if err != nil {
			return connect.NewError(connect.CodeInvalidArgument, err)
		}
		parentID = uuid.NullUUID{UUID: parentMessage.ID, Valid: true}
	}
	runMessages := []string{}
	if parentID.Valid {
		previousRuns, err := c.queries.ListAIConversationRunsForMessagePath(
			ctx,
			db.ListAIConversationRunsForMessagePathParams{
				ID:             parentID.UUID,
				ConversationID: conversationUUID,
			},
		)
		if err != nil {
			return connect.NewError(connect.CodeInternal, err)
		}
		for _, run := range previousRuns {
			runMessages = append(runMessages, run.RunMessages)
		}
	}

	// TODO: can maybe add the prompt auth to this path too
	responseStream, err := c.mensahClient.StreamChat(ctx, &agent_runtime.StreamChatRequest{
		Prompt:                   req.Msg.GetContent(),
		UserId:                   userId,
		WorkspaceId:              req.Msg.GetWorkspaceId(),
		PreviousConversationRuns: runMessages,
	})

	if err != nil {
		return err
	}

	for {
		message, err := responseStream.Recv()
		if err != nil {
			if err == io.EOF {
				return nil
			}
			return err
		}
		// when finished, write the full run to the db
		if finished := message.GetFinished(); finished != nil {
			tx, err := c.db.BeginTx(ctx, nil)
			if err != nil {
				slog.Error("error beginning transaction")
				return connect.NewError(connect.CodeInternal, err)
			}
			defer tx.Rollback()
			p := c.queries.WithTx(tx)
			runMeta := finished.GetRunMetadata()
			run, err := p.CreateAiConversationRun(ctx, db.CreateAiConversationRunParams{
				ConversationID:      conversationUUID,
				InputTokens:         int64(runMeta.InputTokens),
				OutputTokens:        int64(runMeta.OutputTokens),
				ReasoningTokens:     int64(runMeta.ReasoningTokens),
				NumProviderRequests: int64(runMeta.NumProviderRequests),
				NumToolCalls:        int64(runMeta.NumToolCalls),
				RunMessages:         finished.GetRuntimeConvertableJsonString(),
			})
			if err != nil {
				slog.Error("error creating new run")
				return connect.NewError(connect.CodeInternal, err)
			}
			newMessages := finished.GetNewMessages()
			currentParentID := parentID
			for i, message := range newMessages {
				messageJson, err := protojson.Marshal(message)
				if err != nil {
					return connect.NewError(connect.CodeInternal, err)
				}
				clientID := uuid.NewString()
				if message.GetUser() != nil && persistanceOptions != nil &&
					persistanceOptions.GetClientId() != "" {
					clientID = persistanceOptions.GetClientId()
				}
				if message.GetAssistant() != nil && i == len(newMessages)-1 &&
					persistanceOptions != nil &&
					persistanceOptions.ResponseClientId != nil &&
					persistanceOptions.GetResponseClientId() != "" {
					clientID = persistanceOptions.GetResponseClientId()
				}
				position, err := p.NextAIConversationMessagePosition(
					ctx,
					db.NextAIConversationMessagePositionParams{
						ConversationID: conversationUUID,
						ParentID:       currentParentID,
					},
				)
				if err != nil {
					slog.Error("error resolving ai message position")
					return connect.NewError(connect.CodeInternal, err)
				}
				insertedMessage, err := p.AddAIConversationMessage(
					ctx,
					db.AddAIConversationMessageParams{
						ConversationID:       conversationUUID,
						RunID:                run.ID,
						MessageContentAsJson: messageJson,
						ClientID:             clientID,
						ParentID:             currentParentID,
						Position:             position,
					},
				)
				if err != nil {
					slog.Error("error adding new message to ai messages table")
					return connect.NewError(connect.CodeInternal, err)
				}
				currentParentID = uuid.NullUUID{
					UUID:  insertedMessage.ID,
					Valid: true,
				}
			}
			if err := tx.Commit(); err != nil {
				slog.Error("error commiting db transaction", "error", err)
			}
		}
		if err := stream.Send(message); err != nil {
			return err
		}
	}

}
