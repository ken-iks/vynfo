package conversations

import (
	"context"
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
	previousRuns, err := c.queries.ListAIConversationRuns(
		ctx,
		db.ListAIConversationRunsParams{
			ConversationID: conversationUUID,
			Limit:          100,
		},
	)

	runMessages := []string{}
	for _, run := range previousRuns {
		runMessages = append(runMessages, run.RunMessages)
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
			for _, message := range finished.GetNewMessages() {
				messageJson, err := protojson.Marshal(message)
				if err != nil {
					return connect.NewError(connect.CodeInternal, err)
				}
				_, err = p.AddAIConversationMessage(ctx, db.AddAIConversationMessageParams{
					ConversationID:       conversationUUID,
					RunID:                run.ID,
					MessageContentAsJson: messageJson,
				})
				if err != nil {
					slog.Error("error adding new message to ai messages table")
					return connect.NewError(connect.CodeInternal, err)
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
