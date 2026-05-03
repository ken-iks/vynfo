package project

import (
	"bytes"
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"connectrpc.com/connect"
	"github.com/google/uuid"

	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"
	"vynfo.com/vynfo/shared"
)

func imageObjectPath(assetID string) string {
	return fmt.Sprintf("images/%s", assetID)
}

func (p *ProjectServiceServer) UploadImage(
	ctx context.Context,
	req *connect.Request[v1.UploadImageRequest],
) (*connect.Response[v1.UploadImageResponse], error) {
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
	projectID, err := uuid.Parse(req.Msg.GetProjectId())
	if err != nil {
		slog.Error("error parsing project id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	asset, err := q.CreateAsset(ctx, db.CreateAssetParams{
		ProjectID: projectID,
		AssetType: "photo",
	})
	if err != nil {
		slog.Error("error creating asset", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	content := req.Msg.GetContent()
	contentType := http.DetectContentType(content)
	if !strings.HasPrefix(contentType, "image/") {
		return nil, connect.NewError(
			connect.CodeInvalidArgument,
			fmt.Errorf("content type %s is not an image", contentType),
		)
	}
	objectPath := imageObjectPath(asset.ID.String())
	bucket := p.storageClient.Bucket("vedit-v1")
	writer := bucket.Object(objectPath).NewWriter(ctx)
	writer.ContentType = contentType
	if _, err := shared.UploadBytes(writer, bytes.NewReader(content), objectPath, nil); err != nil {
		slog.Error("error uploading image", "asset_id", asset.ID, "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	_, err = q.CreateImage(ctx, db.CreateImageParams{
		AssetID:     asset.ID,
		DisplayName: req.Msg.GetTitle(),
		ObjectPath:  objectPath,
		ContentType: contentType,
	})
	if err != nil {
		slog.Error("error creating image metadata", "asset_id", asset.ID, "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	if err := tx.Commit(); err != nil {
		slog.Error("error committing image upload", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&v1.UploadImageResponse{
		UploadedAssetId: asset.ID.String(),
	}), nil
}
