package vfs

import (
	"context"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/shared"
)

func (f *FileServiceServer) GetRootDirectory(
	ctx context.Context,
	req *connect.Request[v1.GetRootDirectoryRequest],
) (*connect.Response[v1.GetRootDirectoryResponse], error) {
	if _, err := auth.RequireOnboardedUser(ctx, f.queries); err != nil {
		return nil, err
	}
	workspaceId, err := uuid.Parse(req.Msg.GetWorkspaceId())
	if err != nil {
		slog.Error("error parsing workspace id")
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	assets, err := f.queries.GetRootDirectoryAssets(ctx, workspaceId)
	if err != nil {
		slog.Error("error fetching workspace root assets", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	directories, err := f.queries.GetRootDirectories(ctx, workspaceId)
	if err != nil {
		slog.Error("error fetching workspace root directories", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	assetMeta, err := shared.GetAssetMetadata(ctx, f.storageClient, f.queries, assets)
	if err != nil {
		return nil, err
	}

	return connect.NewResponse(&v1.GetRootDirectoryResponse{
		Directories: directoryMetadataList(directories),
		Videos:      assetMeta.Videos,
		Images:      assetMeta.Images,
		Audios:      assetMeta.Audios,
	}), nil
}
