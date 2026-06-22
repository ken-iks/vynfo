package vfs

import (
	"bytes"
	"context"
	"fmt"
	"log/slog"
	"math"
	"os"

	"connectrpc.com/connect"

	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"
	"vynfo.com/vynfo/shared"

	vid "vynfo.com/vynfo/video"
)

const uploadWorkerCount = 5
const uploadSegmentLength = 3

func (f *FileServiceServer) UploadVideo(
	ctx context.Context,
	req *connect.Request[v1.UploadVideoRequest],
	stream *connect.ServerStream[v1.UploadVideoResponse],
) error {
	user, err := auth.RequireOnboardedUser(ctx, f.queries)
	if err != nil {
		return err
	}
	logger := slog.Default().With(
		"user_id", user.ID.String(),
		"workspace_id", req.Msg.GetWorkspaceId(),
		"media_type", "video",
		"content_length_bytes", len(req.Msg.GetContent()),
	)
	workspaceID, err := shared.ParseUUID(ctx, logger, "workspace_id", req.Msg.GetWorkspaceId())
	if err != nil {
		return err
	}

	if err := auth.AssertUserInWorkspace(ctx, workspaceID, f.queries); err != nil {
		return connect.NewError(connect.CodePermissionDenied, err)
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

	content := req.Msg.GetContent()
	tmpFile, err := os.CreateTemp("", "temp-*.mp4")
	if err != nil {
		logger.ErrorContext(ctx, "error opening up temporary file for writing", "error", err)
		return connect.NewError(connect.CodeInternal, err)
	}
	defer os.Remove(tmpFile.Name())
	defer tmpFile.Close()
	_, err = tmpFile.Write(content)
	if err != nil {
		logger.ErrorContext(ctx, "error writing video to temp file", "error", err)
		return connect.NewError(connect.CodeInvalidArgument, err)
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

	asset, err := f.queries.CreateAsset(ctx, db.CreateAssetParams{
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

	originalUploadErr := make(chan error, 1)
	originalUploadFp, err := shared.GetUploadPath(video.AssetID.String(), "video")
	if err != nil {
		logger.ErrorContext(ctx, "error resolving original video upload path", "error", err)
		f.cleanupFailedMediaUpload(ctx, asset.ID, nil, "video")
		return connect.NewError(connect.CodeInternal, err)
	}
	go func(videoBytes []byte, objectPath string) {
		bucket := f.storageClient.Bucket("vedit-v1")
		w := bucket.Object(objectPath).NewWriter(ctx)
		_, err := shared.UploadBytes(
			w, bytes.NewReader(videoBytes), objectPath, nil,
		)
		originalUploadErr <- err
	}(content, originalUploadFp)

	segements, tmpDir, err := vid.GenerateSegments(
		tmpFile.Name(),
		video.AssetID.String(),
		uploadSegmentLength,
		videoDuration,
	)
	if err != nil {
		logger.ErrorContext(ctx, "error initializing segemnter", "error", err)
		<-originalUploadErr
		f.cleanupFailedMediaUpload(ctx, asset.ID, []string{originalUploadFp}, "video")
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
			return stream.Send(&v1.UploadVideoResponse{
				UploadStatus: &v1.UploadVideoResponse_Ongoing{
					Ongoing: &v1.UploadProgressIndicator{
						VideoId:              video.AssetID.String(),
						CompletionPercentage: percentComplete,
					},
				},
			})
		},
	)
	if err != nil {
		<-originalUploadErr
		logger.ErrorContext(ctx, "error uploading video segments", "uploaded_object_count", len(uploadedObjects), "error", err)
		f.cleanupFailedMediaUpload(
			ctx,
			asset.ID,
			append(uploadedObjects, originalUploadFp),
			"video",
		)
		return err
	}

	if err := <-originalUploadErr; err != nil {
		logger.ErrorContext(ctx, "error uploading original video file", "error", err)
		f.cleanupFailedMediaUpload(
			ctx,
			asset.ID,
			append(uploadedObjects, originalUploadFp),
			"video",
		)
		return connect.NewError(connect.CodeInternal, err)
	}
	logger.InfoContext(ctx, "original media uploaded")

	err = manifest.FinishUpload(ctx)
	manifestPath := fmt.Sprintf("manifests/%s.m3u8", video.AssetID.String())
	if err != nil {
		logger.ErrorContext(ctx, "error uploading manifest", "error", err)
		f.cleanupFailedMediaUpload(
			ctx,
			asset.ID,
			append(uploadedObjects, originalUploadFp, manifestPath),
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

	msg := &v1.UploadVideoResponse{
		UploadStatus: &v1.UploadVideoResponse_Finished{
			Finished: &v1.UploadFinishedIndicator{
				VideoId: video.AssetID.String(),
			},
		},
	}
	if err := stream.Send(msg); err != nil {
		logger.ErrorContext(ctx, "error sending upload finished message", "error", err)
		f.cleanupFailedMediaUpload(
			ctx,
			asset.ID,
			append(uploadedObjects, manifestPath, originalUploadFp),
			"video",
		)
		return err
	}
	logger.InfoContext(ctx, "media upload completed")
	return nil
}
