package vfs

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"
)

func (f *FileServiceServer) CreateDirectory(
	ctx context.Context,
	req *connect.Request[v1.CreateDirectoryRequest],
) (*connect.Response[v1.CreateDirectoryResponse], error) {
	if _, err := auth.RequireOnboardedUser(ctx, f.queries); err != nil {
		return nil, err
	}
	workspaceId, err := uuid.Parse(req.Msg.GetWorkspaceId())
	if err != nil {
		slog.Error("error parsing workspace id")
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	if err := auth.AssertUserInWorkspace(ctx, workspaceId, f.queries); err != nil {
		return nil, connect.NewError(connect.CodePermissionDenied, err)
	}

	parentId := uuid.NullUUID{}
	var siblingDirectories []db.Directory
	if req.Msg.ParentDirectoryId != nil {
		parsedParentId, err := uuid.Parse(req.Msg.GetParentDirectoryId())
		if err != nil {
			slog.Error("error parsing parent directory id")
			return nil, connect.NewError(connect.CodeInvalidArgument, err)
		}
		parentDirectory, err := f.queries.GetDirectoryById(ctx, parsedParentId)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return nil, connect.NewError(connect.CodeNotFound, err)
			}
			slog.Error("error fetching parent directory", "error", err)
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		if parentDirectory.WorkspaceID != workspaceId {
			return nil, connect.NewError(connect.CodeNotFound, sql.ErrNoRows)
		}

		parentId = uuid.NullUUID{
			UUID:  parsedParentId,
			Valid: true,
		}
		siblingDirectories, err = f.queries.GetDirectoryChildren(ctx, parentId)
		if err != nil {
			slog.Error("error fetching sibling directories", "error", err)
			return nil, connect.NewError(connect.CodeInternal, err)
		}
	} else {
		siblingDirectories, err = f.queries.GetRootDirectories(ctx, workspaceId)
		if err != nil {
			slog.Error("error fetching root sibling directories", "error", err)
			return nil, connect.NewError(connect.CodeInternal, err)
		}
	}

	name := req.Msg.GetName()
	for _, directory := range siblingDirectories {
		if directory.DisplayName == name {
			return nil, connect.NewError(connect.CodeAlreadyExists, nil)
		}
	}

	directory, err := f.queries.CreateDirectory(ctx, db.CreateDirectoryParams{
		WorkspaceID: workspaceId,
		DisplayName: name,
		ParentID:    parentId,
	})
	if err != nil {
		slog.Error("error creating directory", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&v1.CreateDirectoryResponse{
		CreatedDirectoryId: directory.ID.String(),
	}), nil
}
