package conversations

import (
	"context"

	"connectrpc.com/connect"
	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/gen/proto/v1/inter/agent_runtime"
)

func (c *ConversationServiceServer) SendAgentMessage(
	ctx context.Context,
	req *connect.Request[v1.SendAgentMessageRequest],
	stream *connect.ServerStream[agent_runtime.StreamChatResponse],
) error {
	onboardedUser, err := auth.RequireOnboardedUser(ctx, c.queries)
	if err != nil {
		return err
	} 
	userId := onboardedUser.ID.String()

	responseStream, err := c.mensahClient.StreamChat(ctx, &agent_runtime.StreamChatRequest{
		Prompt: req.Msg.GetContent(),
		UserId: userId,
		WorkspaceId: req.Msg.GetConversationId(),
		// TODO: get conversation messages from db
	})

	if err != nil {
		return err
	}

	for {
		message, err := responseStream.Recv()
		if err != nil {
			return err
		}
		if err := stream.Send(message); err != nil {
			return err
		}
	}

}