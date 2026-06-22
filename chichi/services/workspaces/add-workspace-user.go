package workspaces

import (
	"context"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"

	"google.golang.org/protobuf/types/known/emptypb"
)

func (w *WorkspacesServiceServer) AddWorkspaceUser(
	ctx context.Context,
	req *connect.Request[v1.AddWorkspaceUserRequest],
) (*connect.Response[emptypb.Empty], error) {
	user, err := auth.RequireOnboardedUser(ctx, w.queries)
	if err != nil {
		return nil, err
	}
	logger := slog.Default().With(
		"user_id", user.ID.String(),
		"workspace_id", req.Msg.GetWorkspaceId(),
		"added_user_id", req.Msg.GetUserId(),
	)

	workspaceID, err := uuid.Parse(req.Msg.GetWorkspaceId())
	if err != nil {
		logger.ErrorContext(ctx, "error parsing workspace id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	userID, err := uuid.Parse(req.Msg.GetUserId())
	if err != nil {
		logger.ErrorContext(ctx, "error parsing user id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	isMember, err := w.queries.IsWorkspaceMember(ctx, db.IsWorkspaceMemberParams{
		WorkspaceID: workspaceID,
		MemberID:    user.ID,
	})
	if err != nil {
		logger.ErrorContext(ctx, "error checking workspace membership", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if !isMember {
		return nil, connect.NewError(connect.CodePermissionDenied, nil)
	}

	if err := w.queries.AddWorkspaceMember(ctx, db.AddWorkspaceMemberParams{
		WorkspaceID: workspaceID,
		MemberID:    userID,
	}); err != nil {
		logger.ErrorContext(ctx, "error adding workspace member", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	logger.InfoContext(ctx, "workspace member added")

	return connect.NewResponse(&emptypb.Empty{}), nil
}
