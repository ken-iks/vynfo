package vfs

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/emptypb"
	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"
)

func (f *FileServiceServer) MoveDirectory(
	ctx context.Context,
	req *connect.Request[v1.MoveDirectoryRequest],
) (*connect.Response[emptypb.Empty], error) {
	if _, err := auth.RequireOnboardedUser(ctx, f.queries); err != nil {
		return nil, err
	}
	workspaceID, err := uuid.Parse(req.Msg.GetWorkspaceId())
	if err != nil {
		slog.Error("error parsing workspace id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	if err := auth.AssertUserInWorkspace(ctx, workspaceID, f.queries); err != nil {
		return nil, connect.NewError(connect.CodePermissionDenied, err)
	}
	directoryID, err := uuid.Parse(req.Msg.GetDirectoryId())
	if err != nil {
		slog.Error("error parsing directory id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	directory, err := f.queries.GetDirectoryById(ctx, directoryID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		slog.Error("error fetching directory", "error", err)
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
		slog.Error("error moving directory", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&emptypb.Empty{}), nil
}
