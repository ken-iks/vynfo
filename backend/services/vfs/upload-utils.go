package vfs

import (
	"context"
	"database/sql"
	"errors"
	"iter"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"

	"vynfo.com/vynfo/internal/db"
	vid "vynfo.com/vynfo/video"
)

func (f *FileServiceServer) uploadSegments(
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

func (f *FileServiceServer) cleanupFailedMediaUpload(
	ctx context.Context,
	assetID uuid.UUID,
	objectKeys []string,
	mediaType string,
) {
	cleanupCtx := context.WithoutCancel(ctx)
	bucket := f.storageClient.Bucket("vedit-v1")
	for _, objectKey := range objectKeys {
		if err := bucket.Object(objectKey).Delete(cleanupCtx); err != nil {
			slog.Warn("failed to cleanup uploaded object", "path", objectKey, "error", err)
		}
	}
	if err := f.queries.DeleteAsset(cleanupCtx, assetID); err != nil {
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

func (f *FileServiceServer) uploadParentDirectoryID(
	ctx context.Context,
	workspaceID uuid.UUID,
	parentDirectoryID *string,
) (uuid.NullUUID, error) {
	if parentDirectoryID == nil {
		return uuid.NullUUID{}, nil
	}
	parsedParentID, err := uuid.Parse(*parentDirectoryID)
	if err != nil {
		slog.Error("error parsing parent directory id", "error", err)
		return uuid.NullUUID{}, connect.NewError(connect.CodeInvalidArgument, err)
	}
	parentDirectory, err := f.queries.GetDirectoryById(ctx, parsedParentID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return uuid.NullUUID{}, connect.NewError(connect.CodeNotFound, err)
		}
		slog.Error("error fetching parent directory", "error", err)
		return uuid.NullUUID{}, connect.NewError(connect.CodeInternal, err)
	}
	if parentDirectory.WorkspaceID != workspaceID {
		return uuid.NullUUID{}, connect.NewError(connect.CodeNotFound, sql.ErrNoRows)
	}
	return uuid.NullUUID{
		UUID:  parsedParentID,
		Valid: true,
	}, nil
}

func (f *FileServiceServer) ensureUniqueSiblingAssetName(
	ctx context.Context,
	workspaceID uuid.UUID,
	directoryID uuid.NullUUID,
	name string,
) error {
	var assets []db.Asset
	var err error
	if directoryID.Valid {
		assets, err = f.queries.GetAssetsByDirectory(ctx, directoryID)
	} else {
		assets, err = f.queries.GetRootDirectoryAssets(ctx, workspaceID)
	}
	if err != nil {
		slog.Error("error fetching sibling assets", "error", err)
		return connect.NewError(connect.CodeInternal, err)
	}
	for _, asset := range assets {
		if asset.DisplayName == name {
			return connect.NewError(connect.CodeAlreadyExists, nil)
		}
	}
	return nil
}
