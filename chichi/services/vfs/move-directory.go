package vfs

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"

	"connectrpc.com/connect"
	"google.golang.org/protobuf/types/known/emptypb"
	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"
	"vynfo.com/vynfo/shared"
)

func (f *FileServiceServer) MoveDirectory(
	ctx context.Context,
	req *connect.Request[v1.MoveDirectoryRequest],
) (*connect.Response[emptypb.Empty], error) {
	user, err := auth.RequireOnboardedUser(ctx, f.queries)
	if err != nil {
		return nil, err
	}
	logger := slog.Default().With(
		"user_id", user.ID.String(),
		"workspace_id", req.Msg.GetWorkspaceId(),
		"directory_id", req.Msg.GetDirectoryId(),
	)
	workspaceID, err := shared.ParseUUID(ctx, logger, "workspace_id", req.Msg.GetWorkspaceId())
	if err != nil {
		return nil, err
	}
	if err := auth.AssertUserInWorkspace(ctx, workspaceID, f.queries); err != nil {
		return nil, connect.NewError(connect.CodePermissionDenied, err)
	}
	directoryID, err := shared.ParseUUID(ctx, logger, "directory_id", req.Msg.GetDirectoryId())
	if err != nil {
		return nil, err
	}

	directory, err := f.queries.GetDirectoryById(ctx, directoryID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		logger.ErrorContext(ctx, "error fetching directory", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if directory.WorkspaceID != workspaceID {
		return nil, connect.NewError(connect.CodeNotFound, sql.ErrNoRows)
	}

	parentID, err := f.uploadParentDirectoryID(ctx, workspaceID, req.Msg.NewParentDirectory)
	if err != nil {
		return nil, err
	}
	if err := f.assertDirectoryMoveTarget(ctx, workspaceID, directoryID, parentID); err != nil {
		return nil, err
	}

	siblingDirectories, err := f.siblingDirectories(ctx, workspaceID, parentID)
	if err != nil {
		return nil, err
	}
	for _, sibling := range siblingDirectories {
		if sibling.ID != directoryID && sibling.DisplayName == directory.DisplayName {
			return nil, connect.NewError(connect.CodeAlreadyExists, nil)
		}
	}

	if err := f.queries.ChangeDirectoryParent(ctx, db.ChangeDirectoryParentParams{
		ID:       directoryID,
		ParentID: parentID,
	}); err != nil {
		logger.ErrorContext(ctx, "error moving directory", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if parentID.Valid {
		logger = logger.With("new_parent_directory_id", parentID.UUID.String())
	}
	logger.InfoContext(ctx, "directory moved")

	return connect.NewResponse(&emptypb.Empty{}), nil
}
