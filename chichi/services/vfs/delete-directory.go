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

func (f *FileServiceServer) DeleteDirectory(
	ctx context.Context,
	req *connect.Request[v1.DeleteDirectoryRequest],
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

	assets, err := f.directoryAssetsRecursive(ctx, directoryID)
	if err != nil {
		return nil, err
	}
	usages, err := f.inUseAssetUsages(ctx, assets)
	if err != nil {
		slog.Error("error checking directory asset usage", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if len(usages) > 0 {
		return nil, deleteInUseAssetsError(workspaceID, usages)
	}

	if err := f.queries.DeleteDirectory(ctx, directoryID); err != nil {
		slog.Error("error deleting directory", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

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
