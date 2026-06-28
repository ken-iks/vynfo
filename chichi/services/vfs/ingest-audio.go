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

func (f *FileServiceServer) InitiateAudioIngest(
	ctx context.Context,
	req *connect.Request[v1.InitiateAudioIngestRequest],
	stream *connect.ServerStream[v1.InitiateAudioIngestResponse],
) error {
	user, err := auth.RequireOnboardedUser(ctx, f.queries)
	if err != nil {
		return err
	}
	logger := slog.Default().With(
		"user_id", user.ID.String(),
		"workspace_id", req.Msg.GetWorkspaceId(),
		"media_type", "audio",
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

	tmpFile, err := os.CreateTemp("", "temp-audio-*")
	if err != nil {
		logger.ErrorContext(ctx, "error opening up temporary file for writing", "error", err)
		return connect.NewError(connect.CodeInternal, err)
	}
	defer os.Remove(tmpFile.Name())
	defer tmpFile.Close()

	audioPath, _ := shared.GetOriginalAssetPath(assetId.String(), "audio")
	bucket := f.storageClient.Bucket("vedit-v1")
	reader, err := bucket.Object(audioPath).NewReader(ctx)
	if err != nil {
		logger.ErrorContext(ctx, "asset in pending uploads, but data could not be found at path", "path", audioPath, "error", err)
		if errors.Is(err, storage.ErrObjectNotExist) {
			return connect.NewError(connect.CodeNotFound, err)
		}
		return connect.NewError(connect.CodeInternal, err)
	}
	defer reader.Close()
	if _, err := io.Copy(tmpFile, reader); err != nil {
		logger.ErrorContext(ctx, "error writing audio to temp file", "error", err)
		return connect.NewError(connect.CodeInternal, err)
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

	asset, err := f.queries.CreateAssetWithId(ctx, db.CreateAssetWithIdParams{
		ID:          pendingAsset.AssetID,
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

	segments, tmpDir, err := vid.GenerateAudioSegments(
		tmpFile.Name(),
		audio.AssetID.String(),
		uploadSegmentLength,
		audioDuration,
	)
	if err != nil {
		logger.ErrorContext(ctx, "error initializing audio segmenter", "error", err)
		f.cleanupFailedMediaUpload(ctx, asset.ID, nil, "audio")
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
			return stream.Send(&v1.InitiateAudioIngestResponse{
				IngestStatus: &v1.InitiateAudioIngestResponse_Ongoing{
					Ongoing: &v1.IngestProgressIndicator{
						AssetId:              audio.AssetID.String(),
						CompletionPercentage: percentComplete,
					},
				},
			})
		},
	)
	if err != nil {
		logger.ErrorContext(
			ctx,
			"error uploading audio segments",
			"uploaded_object_count",
			len(uploadedObjects),
			"error",
			err,
		)
		f.cleanupFailedMediaUpload(
			ctx,
			asset.ID,
			uploadedObjects,
			"audio",
		)
		return err
	}

	err = manifest.FinishUpload(ctx)
	manifestPath := fmt.Sprintf("manifests/%s.m3u8", audio.AssetID.String())
	if err != nil {
		logger.ErrorContext(ctx, "error uploading manifest", "error", err)
		f.cleanupFailedMediaUpload(
			ctx,
			asset.ID,
			append(uploadedObjects, manifestPath),
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

	msg := &v1.InitiateAudioIngestResponse{
		IngestStatus: &v1.InitiateAudioIngestResponse_Finished{
			Finished: &v1.IngestFinishedIndicator{
				AssetId: audio.AssetID.String(),
			},
		},
	}
	if err := stream.Send(msg); err != nil {
		logger.ErrorContext(ctx, "error sending upload finished message", "error", err)
		f.cleanupFailedMediaUpload(
			ctx,
			asset.ID,
			append(uploadedObjects, manifestPath),
			"audio",
		)
		return err
	}
	logger.InfoContext(ctx, "media upload completed")
	return nil
}
