package vfs

import (
	"bytes"
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

	content := req.Msg.GetContent()
	tmpFile, err := os.CreateTemp("", "temp-*.mp4")
	if err != nil {
		slog.Error("error opening up temporary file for writing", "error", err)
		return connect.NewError(connect.CodeInternal, err)
	}
	defer os.Remove(tmpFile.Name())
	defer tmpFile.Close()
	_, err = tmpFile.Write(content)
	if err != nil {
		slog.Error("error writing video to temp file", "error", err)
		return connect.NewError(connect.CodeInvalidArgument, err)
	}
	videoDuration, err := vid.ProbeDuration(tmpFile.Name())
	if err != nil {
		slog.Error("could not dertermine video length", "error", err)
		return connect.NewError(connect.CodeInternal, err)
	}
	totalSegments := int(math.Ceil(videoDuration / float64(uploadSegmentLength)))
	if totalSegments < 1 {
		totalSegments = 1
	}

	asset, err := f.queries.CreateAsset(ctx, db.CreateAssetParams{
		WorkspaceID: workspaceID,
		AssetType:   "video",
		DisplayName: req.Msg.GetTitle(),
		DirectoryID: directoryID,
	})
	if err != nil {
		slog.Error("error creating asset", "error", err)
		return connect.NewError(connect.CodeInternal, err)
	}
	video, err := f.queries.CreateVideo(ctx, db.CreateVideoParams{
		AssetID:  asset.ID,
		Duration: videoDuration,
	})
	if err != nil {
		slog.Error("error creating video", "error", err)
		f.cleanupFailedMediaUpload(ctx, asset.ID, nil, "video")
		return connect.NewError(connect.CodeInternal, err)
	}

	originalUploadErr := make(chan error, 1)
	originalUploadFp := fmt.Sprintf("%s/%s.mp4",shared.ORIGINAL_VIDEOS_OBJECT_PATH, video.AssetID.String())
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
		slog.Error("error initializing segemnter", "error", err)
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
		f.cleanupFailedMediaUpload(ctx, asset.ID, append(uploadedObjects, originalUploadFp), "video")
		return err
	}

	if err := <-originalUploadErr; err != nil {
		slog.Error("error uploading original video file", "error", err)
		f.cleanupFailedMediaUpload(ctx, asset.ID, append(uploadedObjects, originalUploadFp), "video")
		return connect.NewError(connect.CodeInternal, err)
	}

	err = manifest.FinishUpload(ctx)
	manifestPath := fmt.Sprintf("manifests/%s.m3u8", video.AssetID.String())
	if err != nil {
		slog.Error("error uploading manifest", "error", err)
		f.cleanupFailedMediaUpload(ctx, asset.ID, append(uploadedObjects, originalUploadFp, manifestPath), "video")
		return connect.NewError(connect.CodeInternal, err)
	}

	msg := &v1.UploadVideoResponse{
		UploadStatus: &v1.UploadVideoResponse_Finished{
			Finished: &v1.UploadFinishedIndicator{
				VideoId: video.AssetID.String(),
			},
		},
	}
	if err := stream.Send(msg); err != nil {
		f.cleanupFailedMediaUpload(ctx, asset.ID, append(uploadedObjects, manifestPath, originalUploadFp), "video")
		return err
	}
	return nil
}
