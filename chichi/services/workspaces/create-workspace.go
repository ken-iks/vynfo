package workspaces

import (
	"context"
	"errors"
	"log/slog"
	"strings"

	"connectrpc.com/connect"
	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"
)

func (w *WorkspacesServiceServer) CreateWorkspace(
	ctx context.Context,
	req *connect.Request[v1.CreateWorkspaceRequest],
) (*connect.Response[v1.CreateWorkspaceResponse], error) {
	user, err := auth.RequireOnboardedUser(ctx, w.queries)
	if err != nil {
		return nil, err
	}
	logger := slog.Default().With("user_id", user.ID.String())
	name := strings.TrimSpace(req.Msg.GetName())
	if name == "" {
		return nil, connect.NewError(
			connect.CodeInvalidArgument,
			errors.New("workspace name is required"),
		)
	}

	tx, err := w.db.BeginTx(ctx, nil)
	if err != nil {
		logger.ErrorContext(ctx, "error beginning transaction", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	defer tx.Rollback()
	q := w.queries.WithTx(tx)

	workspace, err := q.CreateWorkspace(ctx, name)
	if err != nil {
		logger.ErrorContext(ctx, "error creating workspace", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	logger = logger.With("workspace_id", workspace.ID.String())
	if err := q.AddWorkspaceMember(ctx, db.AddWorkspaceMemberParams{
		WorkspaceID: workspace.ID,
		MemberID:    user.ID,
	}); err != nil {
		logger.ErrorContext(ctx, "error adding creator as workspace member", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if err := tx.Commit(); err != nil {
		logger.ErrorContext(ctx, "error committing workspace create", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	logger.InfoContext(ctx, "workspace created")

	return connect.NewResponse(&v1.CreateWorkspaceResponse{
		WorkspaceId: workspace.ID.String(),
	}), nil
}
