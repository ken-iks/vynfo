package vfs

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"os"

	"connectrpc.com/connect"
	"github.com/google/uuid"

	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"

	vid "vynfo.com/vynfo/video"
)

func (f *FileServiceServer) UploadAudio(
	ctx context.Context,
	req *connect.Request[v1.UploadAudioRequest],
	stream *connect.ServerStream[v1.UploadAudioResponse],
) error {
	if _, err := auth.RequireOnboardedUser(ctx, f.queries); err != nil {
		return err
	}
	workspaceID, err := uuid.Parse(req.Msg.GetWorkspaceId())
	if err != nil {
		slog.Error("error parsing workspace id", "error", err)
		return connect.NewError(connect.CodeInvalidArgument, err)
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

	bytes := req.Msg.GetContent()
	tmpFile, err := os.CreateTemp("", "temp-audio-*")
	if err != nil {
		slog.Error("error opening up temporary file for writing", "error", err)
		return connect.NewError(connect.CodeInternal, err)
	}
	defer os.Remove(tmpFile.Name())
	defer tmpFile.Close()
	_, err = tmpFile.Write(bytes)
	if err != nil {
		slog.Error("error writing audio to temp file", "error", err)
		return connect.NewError(connect.CodeInvalidArgument, err)
	}
	audioDuration, err := vid.ProbeDuration(tmpFile.Name())
	if err != nil {
		slog.Error("could not determine audio length", "error", err)
		return connect.NewError(connect.CodeInternal, err)
	}
	totalSegments := int(math.Ceil(audioDuration / float64(uploadSegmentLength)))
	if totalSegments < 1 {
		totalSegments = 1
	}

	asset, err := f.queries.CreateAsset(ctx, db.CreateAssetParams{
		WorkspaceID: workspaceID,
		AssetType:   "audio",
		DisplayName: req.Msg.GetTitle(),
		DirectoryID: directoryID,
	})
	if err != nil {
		slog.Error("error creating asset", "error", err)
		return connect.NewError(connect.CodeInternal, err)
	}
	audio, err := f.queries.CreateAudio(ctx, db.CreateAudioParams{
		AssetID:  asset.ID,
		Duration: audioDuration,
	})
	if err != nil {
		slog.Error("error creating audio", "error", err)
		f.cleanupFailedMediaUpload(ctx, asset.ID, nil, "audio")
		return connect.NewError(connect.CodeInternal, err)
	}

	segments, tmpDir, err := vid.GenerateAudioSegments(
		tmpFile.Name(),
		audio.AssetID.String(),
		uploadSegmentLength,
		audioDuration,
	)
	if err != nil {
		slog.Error("error initializing audio segmenter", "error", err)
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
		f.cleanupFailedMediaUpload(ctx, asset.ID, uploadedObjects, "audio")
		return err
	}

	err = manifest.FinishUpload(ctx)
	manifestPath := fmt.Sprintf("manifests/%s.m3u8", audio.AssetID.String())
	if err != nil {
		slog.Error("error uploading manifest", "error", err)
		f.cleanupFailedMediaUpload(ctx, asset.ID, append(uploadedObjects, manifestPath), "audio")
		return connect.NewError(connect.CodeInternal, err)
	}

	msg := &v1.UploadAudioResponse{
		UploadStatus: &v1.UploadAudioResponse_Finished{
			Finished: &v1.UploadAudioFinishedIndicator{
				AudioId: audio.AssetID.String(),
			},
		},
	}
	if err := stream.Send(msg); err != nil {
		f.cleanupFailedMediaUpload(ctx, asset.ID, append(uploadedObjects, manifestPath), "audio")
		return err
	}
	return nil
}
