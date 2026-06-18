package conversations

import (
	"context"

	"connectrpc.com/connect"
	"vynfo.com/vynfo/auth"
	"vynfo.com/vynfo/gen/proto/v1/inter/agent_runtime"
)

func (c *ConversationServiceServer) GenerateNewTite(
	ctx context.Context,
	req *connect.Request[agent_runtime.GenerateTitleRequest],
) (*connect.Response[agent_runtime.GenerateTitleResponse], error) {
	_, err := auth.RequireOnboardedUser(ctx, c.queries)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}
	title, err := c.mensahClient.GenerateTitle(ctx, req.Msg)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(title), nil
}