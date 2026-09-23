package project

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

func (p *ProjectServiceServer) AddProjectAsset(
	ctx context.Context,
	req *connect.Request[v1.AddProjectAssetRequest],
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

	projectID, err := uuid.Parse(req.Msg.GetProjectId())
	if err != nil {
		logger.ErrorContext(ctx, "error parsing project id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	assetID, err := uuid.Parse(req.Msg.GetAssetId())
	if err != nil {
		logger.ErrorContext(ctx, "error parsing asset id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	project, err := p.queries.GetProject(ctx, projectID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		logger.ErrorContext(ctx, "error fetching project", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if err := auth.AssertUserInWorkspace(ctx, project.WorkspaceID, p.queries); err != nil {
		return nil, connect.NewError(connect.CodePermissionDenied, err)
	}

	asset, err := p.queries.GetAssetById(ctx, assetID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		logger.ErrorContext(ctx, "error fetching asset", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if asset.WorkspaceID != project.WorkspaceID {
		return nil, connect.NewError(connect.CodeNotFound, sql.ErrNoRows)
	}

	if err := p.queries.AddProjectAsset(ctx, db.AddProjectAssetParams{
		ProjectID: projectID,
		AssetID:   assetID,
	}); err != nil {
		logger.ErrorContext(ctx, "error adding project asset", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	logger.InfoContext(ctx, "project asset added")

	return connect.NewResponse(&emptypb.Empty{}), nil
}
