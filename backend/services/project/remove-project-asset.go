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
	user, err := auth.RequireOnboardedUser(ctx, p.queries)
	if err != nil {
		return nil, err
	}
	logger := slog.Default().With(
		"user_id", user.ID.String(),
		"project_id", req.Msg.GetProjectId(),
		"asset_id", req.Msg.GetAssetId(),
	)

	projectId, err := uuid.Parse(req.Msg.GetProjectId())
	if err != nil {
		logger.ErrorContext(ctx, "error parsing project id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	assetId, err := uuid.Parse(req.Msg.GetAssetId())
	if err != nil {
		logger.ErrorContext(ctx, "error parsing asset id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	if err := p.queries.RemoveAssetFromProject(ctx, db.RemoveAssetFromProjectParams{
		ProjectID: projectId,
		AssetID:   assetId,
	}); err != nil {
		logger.ErrorContext(ctx, "error removing project asset", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	logger.InfoContext(ctx, "project asset removed")

	return connect.NewResponse(&emptypb.Empty{}), nil
}
