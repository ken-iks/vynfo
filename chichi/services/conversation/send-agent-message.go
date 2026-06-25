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
	logger := slog.Default().
		With(
			"conversation_id", req.Msg.GetConversationId(),
			"workspace_id", req.Msg.GetWorkspaceId(),
		)
	onboardedUser, err := auth.RequireOnboardedUser(ctx, c.queries)
	if err != nil {
		logger.ErrorContext(ctx, "error authenticating agent message sender", "error", err)
		return connect.NewError(connect.CodeUnauthenticated, err)
	}
	userId := onboardedUser.ID.String()
	logger = logger.With("user_id", userId)
	userUUID, err := uuid.Parse(userId)
	if err != nil {
		logger.ErrorContext(ctx, "unable to parse user id", "error", err)
		return connect.NewError(connect.CodeInvalidArgument, err)
	}
	conversationUUID, err := uuid.Parse(req.Msg.GetConversationId())
	if err != nil {
		logger.ErrorContext(ctx, "unable to parse conversation id", "error", err)
		return connect.NewError(connect.CodeInvalidArgument, err)
	}

	resp, err := c.queries.AssertConversationUser(ctx, db.AssertConversationUserParams{
		ConversationOwnerID: userUUID,
		ID:                  conversationUUID,
	})

	if err != nil {
		logger.ErrorContext(ctx, "conversation not found", "error", err)
		return connect.NewError(connect.CodeInternal, err)
	}
	if !resp {
		logger.WarnContext(ctx, "user does not have access to conversation")
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
			logger.ErrorContext(
				ctx,
				"could not find parent id for message",
				"message_client_id",
				persistanceOptions.ClientId,
				"parent_message_client_id",
				persistanceOptions.ParentClientId,
				"error",
				err,
			)
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
			logger.ErrorContext(
				ctx,
				"could not get parent messages for path",
				"parent_message_id",
				parentID.UUID.String(),
				"error",
				err,
			)
			return connect.NewError(connect.CodeInternal, err)
		}
		latest_run := previousRuns[len(previousRuns)-1]
		latest_token_count := latest_run.InputTokens + latest_run.OutputTokens + latest_run.ReasoningTokens
		logger.InfoContext(
			ctx,
			"previous messages retrieved",
			"message_count",
			len(previousRuns),
			"latest_token_count",
			latest_token_count,
		)
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
		logger.ErrorContext(ctx, "error initializing streamchat stream", "error", err)
		return connect.NewError(connect.CodeInternal, err)
	}
	logger.InfoContext(
		ctx,
		"agent message stream opened",
		"previous_run_count",
		len(runMessages),
	)

	for {
		message, err := responseStream.Recv()
		if err != nil {
			if err == io.EOF {
				logger.InfoContext(ctx, "agent message stream completed")
				return nil
			}
			logger.ErrorContext(ctx, "message stream error", "error", err)
			return connect.NewError(connect.CodeAborted, err)
		}
		// when finished, write the full run to the db
		if finished := message.GetFinished(); finished != nil {
			tx, err := c.db.BeginTx(ctx, nil)
			if err != nil {
				logger.ErrorContext(
					ctx,
					"error beginning transaction for message persistance",
					"error",
					err,
				)
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
				logger.ErrorContext(ctx, "error creating new run", "error", err)
				return connect.NewError(connect.CodeInternal, err)
			}
			logger = logger.With("run_id", run.ID.String())
			logger.InfoContext(
				ctx,
				"agent run persisted",
				"input_tokens",
				runMeta.InputTokens,
				"output_tokens",
				runMeta.OutputTokens,
				"reasoning_tokens",
				runMeta.ReasoningTokens,
				"num_tool_calls",
				runMeta.NumToolCalls,
			)
			newMessages := finished.GetNewMessages()
			currentParentID := parentID
			for i, message := range newMessages {
				messageJson, err := protojson.Marshal(message)
				if err != nil {
					logger.ErrorContext(
						ctx,
						"error marshalling new messages into json",
						"error",
						err,
					)
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
					logger.ErrorContext(ctx, "error resolving ai message position", "error", err)
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
					logger.ErrorContext(
						ctx,
						"error adding new message to ai messages table",
						"parent_id",
						currentParentID,
						"run_id",
						run.ID.String(),
						"error",
						err,
					)
					return connect.NewError(connect.CodeInternal, err)
				}
				currentParentID = uuid.NullUUID{
					UUID:  insertedMessage.ID,
					Valid: true,
				}
			}
			if err := tx.Commit(); err != nil {
				logger.ErrorContext(ctx, "error commiting db transaction", "error", err)
				return connect.NewError(connect.CodeInternal, err)
			}
			logger.InfoContext(
				ctx,
				"agent messages persisted",
				"new_message_count",
				len(newMessages),
			)
		}
		if err := stream.Send(message); err != nil {
			logger.ErrorContext(ctx, "error sending message chunk", "error", err)
			return err
		}
	}

}
