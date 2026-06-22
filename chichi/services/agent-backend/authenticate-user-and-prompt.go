package agentbackend

import (
	"context"
	"log/slog"
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
	logger := slog.Default().With(
		"user_id", req.GetUserId(),
		"workspace_id", req.GetWorkspaceId(),
		"prompt_length", len(prompt),
	)
	// For a bad prompt, we dont give reason why but internally we know
	// we return FALSE if the prompt is suspected of being prompt injection
	if strings.Contains(prompt, "XXX") {
		logger.WarnContext(ctx, "agent prompt denied", "reason", "prompt_filter")
		return &agentbackendpb.AuthenticateUserAndPromptResponse{
			Valid: false,
		}, nil
	}
	workspaceId, err := uuid.Parse(req.GetWorkspaceId())
	if err != nil {
		logger.WarnContext(ctx, "invalid agent auth workspace id", "error", err)
		return nil, status.Error(codes.InvalidArgument, "invalid workspace id")
	}
	userId, err := uuid.Parse(req.GetUserId())
	if err != nil {
		logger.WarnContext(ctx, "invalid agent auth user id", "error", err)
		return nil, status.Error(codes.InvalidArgument, "invalid user id")
	}
	user, err := s.queries.GetUser(ctx, userId)
	if err != nil {
		logger.WarnContext(ctx, "agent auth user not found", "error", err)
		return nil, status.Error(codes.InvalidArgument, "user not in db")
	}
	membership, err := s.queries.IsWorkspaceMember(ctx, db.IsWorkspaceMemberParams{
		WorkspaceID: workspaceId,
		MemberID:    userId,
	})
	if err != nil {
		logger.ErrorContext(ctx, "failed to check agent auth workspace membership", "error", err)
		return nil, status.Error(codes.Internal, "failed to check workspace membership")
	}
	if !membership {
		logger.WarnContext(ctx, "agent auth denied", "reason", "workspace_membership")
		return nil, status.Error(codes.PermissionDenied, "user is not member of workspace")
	}
	if !strings.Contains(user.Email, "kenikeji1") {
		logger.WarnContext(ctx, "agent auth denied", "reason", "allowlist")
		return nil, status.Error(codes.PermissionDenied, "current access to Murch agent is limited")
	}
	logger.InfoContext(ctx, "agent auth approved")
	return &agentbackendpb.AuthenticateUserAndPromptResponse{
		Valid: true,
	}, nil
}
