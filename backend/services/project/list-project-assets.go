package project

import (
	"context"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"

	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/shared"
)

func (p *ProjectServiceServer) ListProjectAssets(
	ctx context.Context,
	req *connect.Request[v1.ListProjectAssetsRequest],
) (*connect.Response[v1.ListProjectAssetsResponse], error) {
	if _, err := auth.RequireOnboardedUser(ctx, p.queries); err != nil {
		return nil, err
	}

	projectID, err := uuid.Parse(req.Msg.GetProjectId())
	if err != nil {
		slog.Error("error parsing project id")
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	assets, err := p.queries.GetProjectAssets(ctx, projectID)
	if err != nil {
		slog.Error("error fetching project assets", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	meta, err := shared.GetAssetMetadata(ctx, p.storageClient, p.queries, assets)
	if err != nil {
		return nil, err
	}

	return connect.NewResponse(&v1.ListProjectAssetsResponse{
		Videos: meta.Videos,
		Images: meta.Images,
		Audios: meta.Audios,
	}), nil

}
