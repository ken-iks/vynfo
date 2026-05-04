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

func (f *FileServiceServer) RenameAsset(
	ctx context.Context,
	req *connect.Request[v1.RenameAssetRequest],
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

	siblingAssets, err := f.siblingAssets(ctx, workspaceID, asset.DirectoryID)
	if err != nil {
		return nil, err
	}
	for _, sibling := range siblingAssets {
		if sibling.ID != assetID && sibling.DisplayName == req.Msg.GetName() {
			return nil, connect.NewError(connect.CodeAlreadyExists, nil)
		}
	}

	if err := f.queries.UpdateAssetName(ctx, db.UpdateAssetNameParams{
		ID:          assetID,
		DisplayName: req.Msg.GetName(),
	}); err != nil {
		slog.Error("error renaming asset", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&emptypb.Empty{}), nil
}

func (f *FileServiceServer) siblingAssets(
	ctx context.Context,
	workspaceID uuid.UUID,
	directoryID uuid.NullUUID,
) ([]db.Asset, error) {
	if directoryID.Valid {
		assets, err := f.queries.GetAssetsByDirectory(ctx, directoryID)
		if err != nil {
			slog.Error("error fetching sibling assets", "error", err)
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		return assets, nil
	}
	assets, err := f.queries.GetRootDirectoryAssets(ctx, workspaceID)
	if err != nil {
		slog.Error("error fetching root sibling assets", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return assets, nil
}
