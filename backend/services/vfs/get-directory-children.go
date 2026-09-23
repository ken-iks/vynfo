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
	"vynfo.com/vynfo/shared"
)

func (f *FileServiceServer) GetDirectoryChildren(
	ctx context.Context,
	req *connect.Request[v1.GetDirectoryChildrenRequest],
) (*connect.Response[v1.GetDirectoryChildrenResponse], error) {
	if _, err := auth.RequireOnboardedUser(ctx, f.queries); err != nil {
		return nil, err
	}
	workspaceId, err := uuid.Parse(req.Msg.GetWorkspaceId())
	if err != nil {
		slog.Error("error parsing workspace id")
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	directoryId, err := uuid.Parse(req.Msg.GetDirectoryId())
	if err != nil {
		slog.Error("error parsing directory id")
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	directory, err := f.queries.GetDirectoryById(ctx, directoryId)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		slog.Error("error fetching directory", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if directory.WorkspaceID != workspaceId {
		return nil, connect.NewError(connect.CodeNotFound, sql.ErrNoRows)
	}

	parentId := uuid.NullUUID{
		UUID:  directoryId,
		Valid: true,
	}
	assets, err := f.queries.GetAssetsByDirectory(ctx, parentId)
	if err != nil {
		slog.Error("error fetching directory assets", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	directories, err := f.queries.GetDirectoryChildren(ctx, parentId)
	if err != nil {
		slog.Error("error fetching directory children", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	assetMeta, err := shared.GetAssetMetadata(ctx, f.storageClient, f.queries, assets)
	if err != nil {
		return nil, err
	}

	return connect.NewResponse(&v1.GetDirectoryChildrenResponse{
		Directories: directoryMetadataList(directories),
		Videos:      assetMeta.Videos,
		Images:      assetMeta.Images,
		Audios:      assetMeta.Audios,
	}), nil
}
