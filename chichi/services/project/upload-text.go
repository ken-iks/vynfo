package project

import (
	"context"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"

	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"
)

func (p *ProjectServiceServer) UploadText(
	ctx context.Context,
	req *connect.Request[v1.UploadTextRequest],
) (*connect.Response[v1.UploadTextResponse], error) {
	tx, err := p.db.BeginTx(ctx, nil)
	if err != nil {
		slog.Error("error starting transaction", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	defer tx.Rollback()
	q := p.queries.WithTx(tx)

	if _, err := auth.RequireOnboardedUser(ctx, p.queries); err != nil {
		return nil, err
	}
	projectID, err := uuid.Parse(req.Msg.GetProject())
	if err != nil {
		slog.Error("error parsing project id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	asset, err := q.CreateAsset(ctx, db.CreateAssetParams{
		ProjectID: projectID,
		AssetType: "text",
	})
	if err != nil {
		slog.Error("error creating asset", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	_, err = q.CreateText(ctx, db.CreateTextParams{
		AssetID:     asset.ID,
		DisplayName: req.Msg.GetTitle(),
		Content:     req.Msg.GetContent(),
	})
	if err != nil {
		slog.Error("error creating text metadata", "asset_id", asset.ID, "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	if err := tx.Commit(); err != nil {
		slog.Error("error committing text upload", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&v1.UploadTextResponse{
		UploadedAssetId: asset.ID.String(),
	}), nil
}
