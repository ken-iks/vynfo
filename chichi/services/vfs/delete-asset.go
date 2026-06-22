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

func (f *FileServiceServer) DeleteAsset(
	ctx context.Context,
	req *connect.Request[v1.DeleteAssetRequest],
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

	usages, err := f.inUseAssetUsages(ctx, []db.Asset{asset})
	if err != nil {
		logger.ErrorContext(ctx, "error checking asset usage", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if len(usages) > 0 {
		logger.WarnContext(ctx, "asset delete blocked by project usage", "usage_count", len(usages))
		return nil, deleteInUseAssetsError(workspaceID, usages)
	}

	if err := f.queries.DeleteAsset(ctx, assetID); err != nil {
		logger.ErrorContext(ctx, "error deleting asset", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	logger.InfoContext(ctx, "asset deleted")

	return connect.NewResponse(&emptypb.Empty{}), nil
}
