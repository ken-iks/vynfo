package conversations

import (
	"context"
	"log/slog"

	"connectrpc.com/connect"
	"vynfo.com/vynfo/auth"
	"vynfo.com/vynfo/gen/proto/v1/inter/agent_runtime"
)

func (c *ConversationServiceServer) GenerateNewTitle(
	ctx context.Context,
	req *connect.Request[agent_runtime.GenerateTitleRequest],
) (*connect.Response[agent_runtime.GenerateTitleResponse], error) {
	user, err := auth.RequireOnboardedUser(ctx, c.queries)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}
	logger := slog.Default().With(
		"user_id", user.ID.String(),
		"prompt_length", len(req.Msg.GetPrompt()),
	)
	title, err := c.agentClient.GenerateTitle(ctx, req.Msg)
	if err != nil {
		logger.ErrorContext(ctx, "error generating ai conversation title", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	logger.InfoContext(ctx, "ai conversation title generated")
	return connect.NewResponse(title), nil
}
