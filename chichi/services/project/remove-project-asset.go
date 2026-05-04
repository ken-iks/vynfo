package project

import (
	"context"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/emptypb"

	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"
)

func (p *ProjectServiceServer) RemoveProjectAsset(
	ctx context.Context,
	req *connect.Request[v1.RemoveProjectAssetRequest],
) (*connect.Response[emptypb.Empty], error) {
	if _, err := auth.RequireOnboardedUser(ctx, p.queries); err != nil {
		return nil, err
	}

	projectId, err := uuid.Parse(req.Msg.GetProjectId())
	if err != nil {
		slog.Error("error parsing project id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	assetId, err := uuid.Parse(req.Msg.GetAssetId())
	if err != nil {
		slog.Error("error parsing asset id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	if err := p.queries.RemoveAssetFromProject(ctx, db.RemoveAssetFromProjectParams{
		ProjectID: projectId,
		AssetID:   assetId,
	}); err != nil {
		slog.Error("error removing project asset", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&emptypb.Empty{}), nil
}
