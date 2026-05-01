package project

import (
	"context"
	"iter"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	vid "vynfo.com/vynfo/video"
)

func (p *ProjectServiceServer) uploadVideoSegments(
	ctx context.Context,
	videoID string,
	totalSegments int,
	manifest *vid.ManifestBuilder,
	segments iter.Seq2[vid.VideoSegment, error],
	stream *connect.ServerStream[v1.UploadVideoResponse],
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
		msg := &v1.UploadVideoResponse{
			UploadStatus: &v1.UploadVideoResponse_Ongoing{
				Ongoing: &v1.UploadProgressIndicator{
					VideoId:              videoID,
					CompletionPercentage: percentComplete,
				},
			},
		}
		if err := stream.Send(msg); err != nil {
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

func (p *ProjectServiceServer) cleanupFailedVideoUpload(
	ctx context.Context,
	assetID uuid.UUID,
	objectKeys []string,
) {
	cleanupCtx := context.WithoutCancel(ctx)
	bucket := p.storageClient.Bucket("vedit-v1")
	for _, objectKey := range objectKeys {
		if err := bucket.Object(objectKey).Delete(cleanupCtx); err != nil {
			slog.Warn("failed to cleanup uploaded object", "path", objectKey, "error", err)
		}
	}
	if err := p.queries.DeleteAsset(cleanupCtx, assetID); err != nil {
		slog.Warn("failed to cleanup failed video asset", "assetID", assetID, "error", err)
	}
}
