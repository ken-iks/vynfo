package project

import (
	"context"
	"fmt"
	"log/slog"
	"os"

	"connectrpc.com/connect"
	"github.com/google/uuid"

	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"

	vid "vynfo.com/vynfo/video"
)

func (p *ProjectServiceServer) UploadVideo(
	ctx context.Context,
	req *connect.Request[v1.UploadVideoRequest],
	stream *connect.ServerStream[v1.UploadVideoResponse],
) error {
	tx, err := p.db.BeginTx(ctx, nil)
	if err != nil {
		slog.Error("error starting transaction", "error", err)
		return connect.NewError(connect.CodeInternal, err)
	}
	defer tx.Rollback()
	q := p.queries.WithTx(tx)

	// TODO: authenticate user
	_, err = uuid.Parse(req.Msg.GetUserId())

	if err != nil {
		slog.Error("error parsing user id", "error", err)
		return connect.NewError(connect.CodeInvalidArgument, err)
	}
	projectID, err := uuid.Parse(req.Msg.GetProjectId())
	if err != nil {
		slog.Error("error parsing project id", "error", err)
		return connect.NewError(connect.CodeInvalidArgument, err)
	}

	bytes := req.Msg.GetContent()
	f, err := os.CreateTemp("external", "temp-*.mp4")
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

	asset, err := q.CreateAsset(ctx, db.CreateAssetParams{
		ProjectID: projectID,
		AssetType: "video",
	})
	if err != nil {
		slog.Error("error creating asset", "error", err)
		return connect.NewError(connect.CodeInternal, err)
	}
	video, err := q.CreateVideo(ctx, db.CreateVideoParams{
		AssetID:     asset.ID,
		DisplayName: req.Msg.GetTitle(),
		Duration:    videoDuration,
	})
	if err != nil {
		slog.Error("error creating video", "error", err)
		return connect.NewError(connect.CodeInternal, err)
	}

	segements, err := vid.GenerateSegments(f.Name(), video.AssetID.String(), 3, videoDuration)
	if err != nil {
		slog.Error("error initializing segemnter", "error", err)
		return connect.NewError(connect.CodeInternal, err)
	}
	manifestFile, err := os.Create(fmt.Sprintf("%s.m3u8", video.AssetID.String()))
	if err != nil {
		slog.Error("error initializing local manifest", "error", err)
		return connect.NewError(connect.CodeAborted, err)
	}
	defer manifestFile.Close()
	manifest := vid.StartManifest(video.AssetID.String(), manifestFile, p.storageClient)
	for seg, err := range segements {
		if err != nil {
			slog.Error("segmentation error", "error", err)
			return connect.NewError(connect.CodeInternal, err)
		}
		if err := manifest.UploadSegment(seg, ctx); err != nil {
			slog.Error("error uploading segment", "percent", seg.PercentComplete, "error", err)
			return connect.NewError(connect.CodeInternal, err)
		}
		msg := &v1.UploadVideoResponse{
			UploadStatus: &v1.UploadVideoResponse_Ongoing{
				Ongoing: &v1.UploadProgressIndicator{
					VideoId:              video.AssetID.String(),
					CompletionPercentage: seg.PercentComplete,
				},
			},
		}
		if err := stream.Send(msg); err != nil {
			return err
		}
	}

	err = manifest.PersistKeyframeMetadata(ctx, video.AssetID, q)
	if err != nil {
		slog.Error("error persisting keyframe metadata", "error", err)
		return connect.NewError(connect.CodeInternal, err)
	}

	err = manifest.FinishUpload(ctx)
	if err != nil {
		slog.Error("error uploading manifest", "error", err)
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
		return err
	}
	return tx.Commit()
}
