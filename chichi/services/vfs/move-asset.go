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

func (f *FileServiceServer) MoveAsset(
	ctx context.Context,
	req *connect.Request[v1.MoveAssetRequest],
) (*connect.Response[emptypb.Empty], error) {
	user, err := auth.RequireOnboardedUser(ctx, f.queries)
	if err != nil {
		return nil, err
	}
	logger := slog.Default().With(
		"user_id", user.ID.String(),
		"workspace_id", req.Msg.GetWorkspaceId(),
		"asset_id", req.Msg.GetAssetId(),
	)
	workspaceID, err := shared.ParseUUID(ctx, logger, "workspace_id", req.Msg.GetWorkspaceId())
	if err != nil {
		return nil, err
	}
	if err := auth.AssertUserInWorkspace(ctx, workspaceID, f.queries); err != nil {
		return nil, connect.NewError(connect.CodePermissionDenied, err)
	}
	assetID, err := shared.ParseUUID(ctx, logger, "asset_id", req.Msg.GetAssetId())
	if err != nil {
		return nil, err
	}

	asset, err := f.queries.GetAssetById(ctx, assetID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		logger.ErrorContext(ctx, "error fetching asset", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if asset.WorkspaceID != workspaceID {
		return nil, connect.NewError(connect.CodeNotFound, sql.ErrNoRows)
	}

	directoryID, err := f.uploadParentDirectoryID(ctx, workspaceID, req.Msg.NewParentDirectory)
	if err != nil {
		return nil, err
	}
	siblingAssets, err := f.siblingAssets(ctx, workspaceID, directoryID)
	if err != nil {
		return nil, err
	}
	for _, sibling := range siblingAssets {
		if sibling.ID != assetID && sibling.DisplayName == asset.DisplayName {
			return nil, connect.NewError(connect.CodeAlreadyExists, nil)
		}
	}

	if err := f.queries.ChangeAssetDirectory(ctx, db.ChangeAssetDirectoryParams{
		ID:          assetID,
		DirectoryID: directoryID,
	}); err != nil {
		logger.ErrorContext(ctx, "error moving asset", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if directoryID.Valid {
		logger = logger.With("new_directory_id", directoryID.UUID.String())
	}
	logger.InfoContext(ctx, "asset moved")

	return connect.NewResponse(&emptypb.Empty{}), nil
}
