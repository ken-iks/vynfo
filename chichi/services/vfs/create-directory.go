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
	"vynfo.com/vynfo/shared"
)

func (f *FileServiceServer) CreateDirectory(
	ctx context.Context,
	req *connect.Request[v1.CreateDirectoryRequest],
) (*connect.Response[v1.CreateDirectoryResponse], error) {
	user, err := auth.RequireOnboardedUser(ctx, f.queries)
	if err != nil {
		return nil, err
	}
	logger := slog.Default().With(
		"user_id", user.ID.String(),
		"workspace_id", req.Msg.GetWorkspaceId(),
	)
	workspaceId, err := shared.ParseUUID(ctx, logger, "workspace_id", req.Msg.GetWorkspaceId())
	if err != nil {
		return nil, err
	}
	if err := auth.AssertUserInWorkspace(ctx, workspaceId, f.queries); err != nil {
		return nil, connect.NewError(connect.CodePermissionDenied, err)
	}

	parentId := uuid.NullUUID{}
	var siblingDirectories []db.Directory
	if req.Msg.ParentDirectoryId != nil {
		parsedParentId, err := shared.ParseUUID(
			ctx,
			logger,
			"parent_directory_id",
			req.Msg.GetParentDirectoryId(),
		)
		if err != nil {
			return nil, err
		}
		logger = logger.With("parent_directory_id", parsedParentId.String())
		parentDirectory, err := f.queries.GetDirectoryById(ctx, parsedParentId)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return nil, connect.NewError(connect.CodeNotFound, err)
			}
			logger.ErrorContext(ctx, "error fetching parent directory", "error", err)
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
			logger.ErrorContext(ctx, "error fetching sibling directories", "error", err)
			return nil, connect.NewError(connect.CodeInternal, err)
		}
	} else {
		siblingDirectories, err = f.queries.GetRootDirectories(ctx, workspaceId)
		if err != nil {
			logger.ErrorContext(ctx, "error fetching root sibling directories", "error", err)
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
		logger.ErrorContext(ctx, "error creating directory", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	logger.InfoContext(ctx, "directory created", "directory_id", directory.ID.String())

	return connect.NewResponse(&v1.CreateDirectoryResponse{
		CreatedDirectoryId: directory.ID.String(),
	}), nil
}
