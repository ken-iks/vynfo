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

func (f *FileServiceServer) UploadAudio(
	ctx context.Context,
	req *connect.Request[v1.UploadAudioRequest],
	stream *connect.ServerStream[v1.UploadAudioResponse],
) error {
	user, err := auth.RequireOnboardedUser(ctx, f.queries)
	if err != nil {
		return err
	}
	logger := slog.Default().With(
		"user_id", user.ID.String(),
		"workspace_id", req.Msg.GetWorkspaceId(),
		"media_type", "audio",
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
	tmpFile, err := os.CreateTemp("", "temp-audio-*")
	if err != nil {
		logger.ErrorContext(ctx, "error opening up temporary file for writing", "error", err)
		return connect.NewError(connect.CodeInternal, err)
	}
	defer os.Remove(tmpFile.Name())
	defer tmpFile.Close()
	_, err = tmpFile.Write(content)
	if err != nil {
		logger.ErrorContext(ctx, "error writing audio to temp file", "error", err)
		return connect.NewError(connect.CodeInvalidArgument, err)
	}
	audioDuration, err := vid.ProbeDuration(tmpFile.Name())
	if err != nil {
		logger.ErrorContext(ctx, "could not determine audio length", "error", err)
		return connect.NewError(connect.CodeInternal, err)
	}
	totalSegments := int(math.Ceil(audioDuration / float64(uploadSegmentLength)))
	if totalSegments < 1 {
		totalSegments = 1
	}
	logger = logger.With(
		"duration_seconds", audioDuration,
		"segment_count", totalSegments,
	)
	logger.InfoContext(ctx, "media metadata probed")

	asset, err := f.queries.CreateAsset(ctx, db.CreateAssetParams{
		WorkspaceID: workspaceID,
		AssetType:   "audio",
		DisplayName: req.Msg.GetTitle(),
		DirectoryID: directoryID,
	})
	if err != nil {
		logger.ErrorContext(ctx, "error creating asset", "error", err)
		return connect.NewError(connect.CodeInternal, err)
	}
	logger = logger.With("asset_id", asset.ID.String())
	audio, err := f.queries.CreateAudio(ctx, db.CreateAudioParams{
		AssetID:  asset.ID,
		Duration: audioDuration,
	})
	if err != nil {
		logger.ErrorContext(ctx, "error creating audio", "error", err)
		f.cleanupFailedMediaUpload(ctx, asset.ID, nil, "audio")
		return connect.NewError(connect.CodeInternal, err)
	}
	logger.InfoContext(ctx, "media asset created")

	originalUploadErr := make(chan error, 1)
	originalUploadFp, err := shared.GetUploadPath(audio.AssetID.String(), "audio")
	if err != nil {
		logger.ErrorContext(ctx, "error resolving original audio upload path", "error", err)
		f.cleanupFailedMediaUpload(ctx, asset.ID, nil, "audio")
		return connect.NewError(connect.CodeInternal, err)
	}
	go func(audioBytes []byte, objectPath string) {
		bucket := f.storageClient.Bucket("vedit-v1")
		w := bucket.Object(objectPath).NewWriter(ctx)
		_, err := shared.UploadBytes(
			w, bytes.NewReader(audioBytes), objectPath, nil,
		)
		originalUploadErr <- err
	}(content, originalUploadFp)

	segments, tmpDir, err := vid.GenerateAudioSegments(
		tmpFile.Name(),
		audio.AssetID.String(),
		uploadSegmentLength,
		audioDuration,
	)
	if err != nil {
		logger.ErrorContext(ctx, "error initializing audio segmenter", "error", err)
		<-originalUploadErr
		f.cleanupFailedMediaUpload(ctx, asset.ID, []string{originalUploadFp}, "audio")
		return connect.NewError(connect.CodeInternal, err)
	}
	defer os.RemoveAll(tmpDir)
	manifest := vid.StartManifest(
		audio.AssetID.String(),
		audio.AssetID,
		f.storageClient,
		f.queries,
		vid.IndexAudioSegment,
	)

	uploadedObjects, err := f.uploadSegments(
		ctx,
		totalSegments,
		&manifest,
		segments,
		func(percentComplete float64) error {
			return stream.Send(&v1.UploadAudioResponse{
				UploadStatus: &v1.UploadAudioResponse_Ongoing{
					Ongoing: &v1.UploadAudioProgressIndicator{
						AudioId:              audio.AssetID.String(),
						CompletionPercentage: percentComplete,
					},
				},
			})
		},
	)
	if err != nil {
		<-originalUploadErr
		logger.ErrorContext(ctx, "error uploading audio segments", "uploaded_object_count", len(uploadedObjects), "error", err)
		f.cleanupFailedMediaUpload(
			ctx,
			asset.ID,
			append(uploadedObjects, originalUploadFp),
			"audio",
		)
		return err
	}

	if err := <-originalUploadErr; err != nil {
		logger.ErrorContext(ctx, "error uploading original audio file", "error", err)
		f.cleanupFailedMediaUpload(
			ctx,
			asset.ID,
			append(uploadedObjects, originalUploadFp),
			"audio",
		)
		return connect.NewError(connect.CodeInternal, err)
	}
	logger.InfoContext(ctx, "original media uploaded")

	err = manifest.FinishUpload(ctx)
	manifestPath := fmt.Sprintf("manifests/%s.m3u8", audio.AssetID.String())
	if err != nil {
		logger.ErrorContext(ctx, "error uploading manifest", "error", err)
		f.cleanupFailedMediaUpload(
			ctx,
			asset.ID,
			append(uploadedObjects, originalUploadFp, manifestPath),
			"audio",
		)
		return connect.NewError(connect.CodeInternal, err)
	}
	logger.InfoContext(
		ctx,
		"media manifest uploaded",
		"uploaded_object_count",
		len(uploadedObjects),
	)

	msg := &v1.UploadAudioResponse{
		UploadStatus: &v1.UploadAudioResponse_Finished{
			Finished: &v1.UploadAudioFinishedIndicator{
				AudioId: audio.AssetID.String(),
			},
		},
	}
	if err := stream.Send(msg); err != nil {
		logger.ErrorContext(ctx, "error sending upload finished message", "error", err)
		f.cleanupFailedMediaUpload(
			ctx,
			asset.ID,
			append(uploadedObjects, manifestPath, originalUploadFp),
			"audio",
		)
		return err
	}
	logger.InfoContext(ctx, "media upload completed")
	return nil
}
