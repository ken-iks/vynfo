package project

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

const uploadWorkerCount = 5
const uploadSegmentLength = 3

func (p *ProjectServiceServer) UploadVideo(
	ctx context.Context,
	req *connect.Request[v1.UploadVideoRequest],
	stream *connect.ServerStream[v1.UploadVideoResponse],
) error {
	if _, err := auth.RequireOnboardedUser(ctx, p.queries); err != nil {
		return err
	}
	projectID, err := uuid.Parse(req.Msg.GetProjectId())
	if err != nil {
		slog.Error("error parsing project id", "error", err)
		return connect.NewError(connect.CodeInvalidArgument, err)
	}

	bytes := req.Msg.GetContent()
	f, err := os.CreateTemp("", "temp-*.mp4")
	if err != nil {
		slog.Error("error opening up temporary file for writing", "error", err)
		return connect.NewError(connect.CodeInternal, err)
	}
	defer os.Remove(f.Name())
	defer f.Close()
	_, err = f.Write(bytes)
	if err != nil {
		slog.Error("error writing video to temp file", "error", err)
		return connect.NewError(connect.CodeInvalidArgument, err)
	}
	videoDuration, err := vid.ProbeDuration(f.Name())
	if err != nil {
		slog.Error("could not dertermine video length", "error", err)
		return connect.NewError(connect.CodeInternal, err)
	}
	totalSegments := int(math.Ceil(videoDuration / float64(uploadSegmentLength)))
	if totalSegments < 1 {
		totalSegments = 1
	}

	asset, err := createProjectAsset(ctx, p.queries, projectID, "video")
	if err != nil {
		slog.Error("error creating asset", "error", err)
		return connect.NewError(connect.CodeInternal, err)
	}
	video, err := p.queries.CreateVideo(ctx, db.CreateVideoParams{
		AssetID:     asset.ID,
		DisplayName: req.Msg.GetTitle(),
		Duration:    videoDuration,
	})
	if err != nil {
		slog.Error("error creating video", "error", err)
		p.cleanupFailedMediaUpload(ctx, asset.ID, nil, "video")
		return connect.NewError(connect.CodeInternal, err)
	}

	segements, tmpDir, err := vid.GenerateSegments(
		f.Name(),
		video.AssetID.String(),
		uploadSegmentLength,
		videoDuration,
	)
	if err != nil {
		slog.Error("error initializing segemnter", "error", err)
		p.cleanupFailedMediaUpload(ctx, asset.ID, nil, "video")
		return connect.NewError(connect.CodeInternal, err)
	}
	defer os.RemoveAll(tmpDir)
	manifest := vid.StartManifest(
		video.AssetID.String(),
		video.AssetID,
		p.storageClient,
		p.queries,
		vid.IndexVideoSegment,
	)

	uploadedObjects, err := p.uploadSegments(
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
		p.cleanupFailedMediaUpload(ctx, asset.ID, uploadedObjects, "video")
		return err
	}

	err = manifest.FinishUpload(ctx)
	manifestPath := fmt.Sprintf("manifests/%s.m3u8", video.AssetID.String())
	if err != nil {
		slog.Error("error uploading manifest", "error", err)
		p.cleanupFailedMediaUpload(ctx, asset.ID, append(uploadedObjects, manifestPath), "video")
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
		p.cleanupFailedMediaUpload(ctx, asset.ID, append(uploadedObjects, manifestPath), "video")
		return err
	}
	return nil
}
