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
	"vynfo.com/vynfo/shared"
)

func (f *FileServiceServer) DeleteDirectory(
	ctx context.Context,
	req *connect.Request[v1.DeleteDirectoryRequest],
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

	assets, err := f.directoryAssetsRecursive(ctx, directoryID)
	if err != nil {
		return nil, err
	}
	usages, err := f.inUseAssetUsages(ctx, assets)
	if err != nil {
		logger.ErrorContext(ctx, "error checking directory asset usage", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if len(usages) > 0 {
		logger.WarnContext(ctx, "directory delete blocked by in-use assets", "usage_count", len(usages))
		return nil, deleteInUseAssetsError(workspaceID, usages)
	}

	if err := f.queries.DeleteDirectory(ctx, directoryID); err != nil {
		logger.ErrorContext(ctx, "error deleting directory", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	logger.InfoContext(ctx, "directory deleted", "asset_count", len(assets))

	return connect.NewResponse(&emptypb.Empty{}), nil
}

func (f *FileServiceServer) directoryAssetsRecursive(
	ctx context.Context,
	directoryID uuid.UUID,
) ([]db.Asset, error) {
	parentID := uuid.NullUUID{
		UUID:  directoryID,
		Valid: true,
	}
	assets, err := f.queries.GetAssetsByDirectory(ctx, parentID)
	if err != nil {
		slog.Error("error fetching directory assets", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	directories, err := f.queries.GetDirectoryChildren(ctx, parentID)
	if err != nil {
		slog.Error("error fetching directory children", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	for _, directory := range directories {
		childAssets, err := f.directoryAssetsRecursive(ctx, directory.ID)
		if err != nil {
			return nil, err
		}
		assets = append(assets, childAssets...)
	}
	return assets, nil
}
