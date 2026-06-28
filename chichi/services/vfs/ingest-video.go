package vfs

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math"
	"os"

	"cloud.google.com/go/storage"
	"connectrpc.com/connect"

	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"
	"vynfo.com/vynfo/shared"

	vid "vynfo.com/vynfo/video"
)

const uploadWorkerCount = 5
const uploadSegmentLength = 3

func (f *FileServiceServer) InitiateVideoIngest(
	ctx context.Context,
	req *connect.Request[v1.InitiateVideoIngestRequest],
	stream *connect.ServerStream[v1.InitiateVideoIngestResponse],
) error {
	user, err := auth.RequireOnboardedUser(ctx, f.queries)
	if err != nil {
		return err
	}
	logger := slog.Default().With(
		"user_id", user.ID.String(),
		"workspace_id", req.Msg.GetWorkspaceId(),
		"media_type", "video",
		"asset_id", req.Msg.GetAssetId(),
	)
	workspaceID, err := shared.ParseUUID(ctx, logger, "workspace_id", req.Msg.GetWorkspaceId())
	if err != nil {
		return err
	}

	assetId, err := shared.ParseUUID(ctx, logger, "asset_id", req.Msg.GetAssetId())
	if err != nil {
		return err
	}

	if err := auth.AssertUserInWorkspace(ctx, workspaceID, f.queries); err != nil {
		return connect.NewError(connect.CodePermissionDenied, err)
	}
	pendingAsset, err := f.queries.GetPendingAsset(ctx, db.GetPendingAssetParams{
		UserID:  user.ID,
		AssetID: assetId,
	})
	if err != nil {
		logger.ErrorContext(ctx, "trying to upload an asset that is not in the pending assets table", "error", err)
		return err
	}
	directoryID, err := f.uploadParentDirectoryID(ctx, workspaceID, req.Msg.ParentDirectoryId)
	if err != nil {
		return err
	}
	if err := f.ensureUniqueSiblingAssetName(ctx, workspaceID, directoryID, req.Msg.GetTitle()); err != nil {
		return err
	}
	if directoryID.Valid {
		logger = logger.With("directory_id", directoryID.UUID.String())
	}
	logger.InfoContext(ctx, "media upload started")

	tmpFile, err := os.CreateTemp("", "temp-*.mp4")
	if err != nil {
		logger.ErrorContext(ctx, "error opening up temporary file for writing", "error", err)
		return connect.NewError(connect.CodeInternal, err)
	}
	defer os.Remove(tmpFile.Name())
	defer tmpFile.Close()

	videoPath, _ := shared.GetOriginalAssetPath(pendingAsset.AssetID.String(), "video")
	bucket := f.storageClient.Bucket("vedit-v1")
	reader, err := bucket.Object(videoPath).NewReader(ctx)
	if err != nil {
		logger.ErrorContext(ctx, "asset in pending uploads, but data could not be found at path", "path", videoPath, "error", err)
		if errors.Is(err, storage.ErrObjectNotExist) {
			return connect.NewError(connect.CodeNotFound, err)
		}
		return connect.NewError(connect.CodeInternal, err)
	}
	defer reader.Close()
	if _, err := io.Copy(tmpFile, reader); err != nil {
		logger.ErrorContext(ctx, "error writing video to temp file", "error", err)
		return connect.NewError(connect.CodeInternal, err)
	}
	videoDuration, err := vid.ProbeDuration(tmpFile.Name())
	if err != nil {
		logger.ErrorContext(ctx, "could not dertermine video length", "error", err)
		return connect.NewError(connect.CodeInternal, err)
	}
	hasAudio, err := vid.ProbeHasAudio(tmpFile.Name())
	if err != nil {
		logger.ErrorContext(ctx, "could not determine whether video has audio", "error", err)
		return connect.NewError(connect.CodeInternal, err)
	}
	totalSegments := int(math.Ceil(videoDuration / float64(uploadSegmentLength)))
	if totalSegments < 1 {
		totalSegments = 1
	}
	logger = logger.With(
		"duration_seconds", videoDuration,
		"has_audio", hasAudio,
		"segment_count", totalSegments,
	)
	logger.InfoContext(ctx, "media metadata probed")

	asset, err := f.queries.CreateAssetWithId(ctx, db.CreateAssetWithIdParams{
		ID:          pendingAsset.AssetID,
		WorkspaceID: workspaceID,
		AssetType:   "video",
		DisplayName: req.Msg.GetTitle(),
		DirectoryID: directoryID,
	})
	if err != nil {
		logger.ErrorContext(ctx, "error creating asset", "error", err)
		return connect.NewError(connect.CodeInternal, err)
	}
	logger = logger.With("asset_id", asset.ID.String())
	video, err := f.queries.CreateVideo(ctx, db.CreateVideoParams{
		AssetID:  asset.ID,
		Duration: videoDuration,
		HasAudio: hasAudio,
	})
	if err != nil {
		logger.ErrorContext(ctx, "error creating video", "error", err)
		f.cleanupFailedMediaUpload(ctx, asset.ID, nil, "video")
		return connect.NewError(connect.CodeInternal, err)
	}
	logger.InfoContext(ctx, "media asset created")

	segements, tmpDir, err := vid.GenerateSegments(
		tmpFile.Name(),
		video.AssetID.String(),
		uploadSegmentLength,
		videoDuration,
	)
	if err != nil {
		logger.ErrorContext(ctx, "error initializing segemnter", "error", err)
		f.cleanupFailedMediaUpload(ctx, asset.ID, nil, "video")
		return connect.NewError(connect.CodeInternal, err)
	}
	defer os.RemoveAll(tmpDir)
	manifest := vid.StartManifest(
		video.AssetID.String(),
		video.AssetID,
		f.storageClient,
		f.queries,
		vid.IndexVideoSegment,
	)

	uploadedObjects, err := f.uploadSegments(
		ctx,
		totalSegments,
		&manifest,
		segements,
		func(percentComplete float64) error {
			return stream.Send(&v1.InitiateVideoIngestResponse{
				IngestStatus: &v1.InitiateVideoIngestResponse_Ongoing{
					Ongoing: &v1.IngestProgressIndicator{
						AssetId:              video.AssetID.String(),
						CompletionPercentage: percentComplete,
					},
				},
			})
		},
	)
	if err != nil {
		logger.ErrorContext(
			ctx,
			"error uploading video segments",
			"uploaded_object_count",
			len(uploadedObjects),
			"error",
			err,
		)
		f.cleanupFailedMediaUpload(
			ctx,
			asset.ID,
			uploadedObjects,
			"video",
		)
		return err
	}

	err = manifest.FinishUpload(ctx)
	manifestPath := fmt.Sprintf("manifests/%s.m3u8", video.AssetID.String())
	if err != nil {
		logger.ErrorContext(ctx, "error uploading manifest", "error", err)
		f.cleanupFailedMediaUpload(
			ctx,
			asset.ID,
			append(uploadedObjects, manifestPath),
			"video",
		)
		return connect.NewError(connect.CodeInternal, err)
	}
	logger.InfoContext(
		ctx,
		"media manifest uploaded",
		"uploaded_object_count",
		len(uploadedObjects),
	)

	msg := &v1.InitiateVideoIngestResponse{
		IngestStatus: &v1.InitiateVideoIngestResponse_Finished{
			Finished: &v1.IngestFinishedIndicator{
				AssetId: video.AssetID.String(),
			},
		},
	}
	if err := stream.Send(msg); err != nil {
		logger.ErrorContext(ctx, "error sending upload finished message", "error", err)
		f.cleanupFailedMediaUpload(
			ctx,
			asset.ID,
			append(uploadedObjects, manifestPath),
			"video",
		)
		return err
	}
	logger.InfoContext(ctx, "media upload completed")
	return nil
}
