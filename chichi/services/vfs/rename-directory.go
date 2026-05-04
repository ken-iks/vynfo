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

func (f *FileServiceServer) RenameDirectory(
	ctx context.Context,
	req *connect.Request[v1.RenameDirectoryRequest],
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

	siblingDirectories, err := f.siblingDirectories(ctx, workspaceID, directory.ParentID)
	if err != nil {
		return nil, err
	}
	for _, sibling := range siblingDirectories {
		if sibling.ID != directoryID && sibling.DisplayName == req.Msg.GetName() {
			return nil, connect.NewError(connect.CodeAlreadyExists, nil)
		}
	}

	if err := f.queries.UpdateDirectoryName(ctx, db.UpdateDirectoryNameParams{
		ID:          directoryID,
		DisplayName: req.Msg.GetName(),
	}); err != nil {
		slog.Error("error renaming directory", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&emptypb.Empty{}), nil
}

func (f *FileServiceServer) siblingDirectories(
	ctx context.Context,
	workspaceID uuid.UUID,
	parentID uuid.NullUUID,
) ([]db.Directory, error) {
	if parentID.Valid {
		directories, err := f.queries.GetDirectoryChildren(ctx, parentID)
		if err != nil {
			slog.Error("error fetching sibling directories", "error", err)
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		return directories, nil
	}
	directories, err := f.queries.GetRootDirectories(ctx, workspaceID)
	if err != nil {
		slog.Error("error fetching root sibling directories", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return directories, nil
}
