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

func (f *FileServiceServer) DeleteAsset(
	ctx context.Context,
	req *connect.Request[v1.DeleteAssetRequest],
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
	assetID, err := uuid.Parse(req.Msg.GetAssetId())
	if err != nil {
		slog.Error("error parsing asset id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	asset, err := f.queries.GetAssetById(ctx, assetID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		slog.Error("error fetching asset", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if asset.WorkspaceID != workspaceID {
		return nil, connect.NewError(connect.CodeNotFound, sql.ErrNoRows)
	}

	usages, err := f.inUseAssetUsages(ctx, []db.Asset{asset})
	if err != nil {
		slog.Error("error checking asset usage", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if len(usages) > 0 {
		return nil, deleteInUseAssetsError(workspaceID, usages)
	}

	if err := f.queries.DeleteAsset(ctx, assetID); err != nil {
		slog.Error("error deleting asset", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&emptypb.Empty{}), nil
}
