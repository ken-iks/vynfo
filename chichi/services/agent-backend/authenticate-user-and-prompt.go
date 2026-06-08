package agentbackend

import (
	"context"
	"strings"

	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	agentbackendpb "vynfo.com/vynfo/gen/proto/v1/inter/agent_backend"
	"vynfo.com/vynfo/internal/db"
)

func (s *AgentBackendServiceServer) AuthenticateUserAndPrompt(
	ctx context.Context,
	req *agentbackendpb.AuthenticateUserAndPromptRequest,
) (*agentbackendpb.AuthenticateUserAndPromptResponse, error) {
	prompt := req.GetPrompt()
	// For a bad prompt, we dont give reason why but internally we know
	// we return FALSE if the prompt is suspected of being prompt injection
	if strings.Contains(prompt, "XXX") {
		return &agentbackendpb.AuthenticateUserAndPromptResponse{
			Valid: false,
		}, nil
	}
	workspaceId, err := uuid.Parse(req.GetWorkspaceId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid workspace id")
	}
	userId, err := uuid.Parse(req.GetUserId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid user id")
	}
	membership, err := s.queries.IsWorkspaceMember(ctx, db.IsWorkspaceMemberParams{
		WorkspaceID: workspaceId,
		MemberID: userId,
	})
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to check workspace membership")
	}
	if !membership {
		return nil, status.Error(codes.PermissionDenied, "user is not member of workspace")
	}
	return &agentbackendpb.AuthenticateUserAndPromptResponse{
		Valid: true,
	}, nil
}