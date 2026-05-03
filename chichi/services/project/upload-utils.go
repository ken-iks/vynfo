package project

import (
	"context"
	"iter"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	vid "vynfo.com/vynfo/video"
)

func (p *ProjectServiceServer) uploadSegments(
	ctx context.Context,
	totalSegments int,
	manifest *vid.ManifestBuilder,
	segments iter.Seq2[vid.VideoSegment, error],
	sendProgress func(float64) error,
) ([]string, error) {
	worker := vid.UploadWorker{
		WorkerCount: uploadWorkerCount,
		Manifest:    manifest,
	}
	uploadCtx, cancelUpload := context.WithCancel(ctx)
	defer cancelUpload()
	var uploadedObjects []string
	var completedSegments int
	var uploadErr error
	var streamErr error
	for result := range worker.Upload(uploadCtx, segments) {
		if result.ObjectKey != "" {
			uploadedObjects = append(uploadedObjects, result.ObjectKey)
		}
		if result.Err != nil {
			if uploadErr == nil {
				uploadErr = result.Err
				cancelUpload()
				slog.Error(
					"error uploading segment",
					"objectKey",
					result.ObjectKey,
					"error",
					result.Err,
				)
			}
			continue
		}
		if uploadErr != nil || streamErr != nil {
			continue
		}
		completedSegments++
		percentComplete := (float64(completedSegments) / float64(totalSegments)) * 100
		if percentComplete > 100 {
			percentComplete = 100
		}
		if err := sendProgress(percentComplete); err != nil {
			streamErr = err
			cancelUpload()
		}
	}
	if streamErr != nil {
		return uploadedObjects, streamErr
	}
	if uploadErr != nil {
		return uploadedObjects, connect.NewError(connect.CodeInternal, uploadErr)
	}
	return uploadedObjects, nil
}

func (p *ProjectServiceServer) cleanupFailedMediaUpload(
	ctx context.Context,
	assetID uuid.UUID,
	objectKeys []string,
	mediaType string,
) {
	cleanupCtx := context.WithoutCancel(ctx)
	bucket := p.storageClient.Bucket("vedit-v1")
	for _, objectKey := range objectKeys {
		if err := bucket.Object(objectKey).Delete(cleanupCtx); err != nil {
			slog.Warn("failed to cleanup uploaded object", "path", objectKey, "error", err)
		}
	}
	if err := p.queries.DeleteAsset(cleanupCtx, assetID); err != nil {
		slog.Warn(
			"failed to cleanup failed media asset",
			"mediaType",
			mediaType,
			"assetID",
			assetID,
			"error",
			err,
		)
	}
}
