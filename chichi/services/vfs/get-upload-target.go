package vfs

import (
	"context"
	"log/slog"
	"time"

	"cloud.google.com/go/storage"
	"connectrpc.com/connect"
	"github.com/google/uuid"
	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"
	"vynfo.com/vynfo/shared"
)

func (f *FileServiceServer) GetAssetUploadTarget(
	ctx context.Context,
	req *connect.Request[v1.GetAssetUploadTargetRequest],
) (*connect.Response[v1.GetAssetUploadTargetResponse], error) {
	user, err := auth.RequireOnboardedUser(ctx, f.queries)
	if err != nil {
		return nil, err
	}

	logger := slog.With(
		"user_id", user.ID.String(),
		"workspace_id", req.Msg.GetWorkspaceId(),
	)

	pendingAsset, err := f.queries.AddPendingAsset(ctx, db.AddPendingAssetParams{
		UserID:  user.ID,
		AssetID: uuid.New(),
	})
	if err != nil {
		logger.ErrorContext(ctx, "unable to initialize pending asset for upload target")
		return nil, err
	}
	logger.Info("generating pending upload targets", "asset_id", pendingAsset.AssetID.String())

	videoPath, _ := shared.GetOriginalAssetPath(pendingAsset.AssetID.String(), "video")
	videoSigned, err := f.storageClient.Bucket("vedit-v1").SignedURL(videoPath, &storage.SignedURLOptions{
		Method:  "PUT",
		Expires: time.Now().Add(2 * time.Minute),
		Headers: []string{"Content-Type: video/mp4"},
	})
	if err != nil {
		logger.ErrorContext(ctx, "error generating signed url for pending video asset", "error", err)
		return nil, err
	}

	audioPath, _ := shared.GetOriginalAssetPath(pendingAsset.AssetID.String(), "audio")
	audioSigned, err := f.storageClient.Bucket("vedit-v1").SignedURL(audioPath, &storage.SignedURLOptions{
		Method:  "PUT",
		Expires: time.Now().Add(2 * time.Minute),
		Headers: []string{"Content-Type: audio/mp3"},
	})
	if err != nil {
		logger.ErrorContext(ctx, "error generating signed url for pending audio asset", "error", err)
		return nil, err
	}

	return connect.NewResponse(&v1.GetAssetUploadTargetResponse{
		AssetId:     pendingAsset.AssetID.String(),
		VideoTarget: videoSigned,
		AudioTarget: audioSigned,
	}), nil
}
