package vfs

import (
	"bytes"
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"connectrpc.com/connect"

	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"
	"vynfo.com/vynfo/shared"
)

func imageObjectPath(assetID string) string {
	return fmt.Sprintf("images/%s", assetID)
}

func (f *FileServiceServer) UploadImage(
	ctx context.Context,
	req *connect.Request[v1.UploadImageRequest],
) (*connect.Response[v1.UploadImageResponse], error) {
	user, err := auth.RequireOnboardedUser(ctx, f.queries)
	if err != nil {
		return nil, err
	}
	logger := slog.Default().With(
		"user_id", user.ID.String(),
		"workspace_id", req.Msg.GetWorkspaceId(),
		"media_type", "image",
		"content_length_bytes", len(req.Msg.GetContent()),
	)
	workspaceID, err := shared.ParseUUID(ctx, logger, "workspace_id", req.Msg.GetWorkspaceId())
	if err != nil {
		return nil, err
	}

	if err := auth.AssertUserInWorkspace(ctx, workspaceID, f.queries); err != nil {
		return nil, connect.NewError(connect.CodePermissionDenied, err)
	}
	directoryID, err := f.uploadParentDirectoryID(ctx, workspaceID, req.Msg.ParentDirectoryId)
	if err != nil {
		return nil, err
	}
	if err := f.ensureUniqueSiblingAssetName(ctx, workspaceID, directoryID, req.Msg.GetTitle()); err != nil {
		return nil, err
	}
	if directoryID.Valid {
		logger = logger.With("directory_id", directoryID.UUID.String())
	}
	logger.InfoContext(ctx, "media upload started")

	content := req.Msg.GetContent()
	contentType := http.DetectContentType(content)
	if !strings.HasPrefix(contentType, "image/") {
		return nil, connect.NewError(
			connect.CodeInvalidArgument,
			fmt.Errorf("content type %s is not an image", contentType),
		)
	}
	logger = logger.With("content_type", contentType)

	asset, err := f.queries.CreateAsset(ctx, db.CreateAssetParams{
		WorkspaceID: workspaceID,
		AssetType:   "photo",
		DisplayName: req.Msg.GetTitle(),
		DirectoryID: directoryID,
	})
	if err != nil {
		logger.ErrorContext(ctx, "error creating asset", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	logger = logger.With("asset_id", asset.ID.String())

	objectPath := imageObjectPath(asset.ID.String())
	bucket := f.storageClient.Bucket("vedit-v1")
	writer := bucket.Object(objectPath).NewWriter(ctx)
	writer.ContentType = contentType
	if _, err := shared.UploadBytes(writer, bytes.NewReader(content), objectPath, nil); err != nil {
		logger.ErrorContext(ctx, "error uploading image", "error", err)
		f.cleanupFailedMediaUpload(ctx, asset.ID, []string{objectPath}, "image")
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	_, err = f.queries.CreateImage(ctx, db.CreateImageParams{
		AssetID:     asset.ID,
		ObjectPath:  objectPath,
		ContentType: contentType,
	})
	if err != nil {
		logger.ErrorContext(ctx, "error creating image metadata", "error", err)
		f.cleanupFailedMediaUpload(ctx, asset.ID, []string{objectPath}, "image")
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	logger.InfoContext(ctx, "media upload completed")

	return connect.NewResponse(&v1.UploadImageResponse{
		UploadedAssetId: asset.ID.String(),
	}), nil
}
