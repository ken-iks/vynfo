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

func (p *ProjectServiceServer) UploadAudio(
	ctx context.Context,
	req *connect.Request[v1.UploadAudioRequest],
	stream *connect.ServerStream[v1.UploadAudioResponse],
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
	f, err := os.CreateTemp("", "temp-audio-*")
	if err != nil {
		slog.Error("error opening up temporary file for writing", "error", err)
		return connect.NewError(connect.CodeInternal, err)
	}
	defer os.Remove(f.Name())
	defer f.Close()
	_, err = f.Write(bytes)
	if err != nil {
		slog.Error("error writing audio to temp file", "error", err)
		return connect.NewError(connect.CodeInvalidArgument, err)
	}
	audioDuration, err := vid.ProbeDuration(f.Name())
	if err != nil {
		slog.Error("could not determine audio length", "error", err)
		return connect.NewError(connect.CodeInternal, err)
	}
	totalSegments := int(math.Ceil(audioDuration / float64(uploadSegmentLength)))
	if totalSegments < 1 {
		totalSegments = 1
	}

	asset, err := createProjectAsset(ctx, p.queries, projectID, "audio")
	if err != nil {
		slog.Error("error creating asset", "error", err)
		return connect.NewError(connect.CodeInternal, err)
	}
	audio, err := p.queries.CreateAudio(ctx, db.CreateAudioParams{
		AssetID:     asset.ID,
		DisplayName: req.Msg.GetTitle(),
		Duration:    audioDuration,
	})
	if err != nil {
		slog.Error("error creating audio", "error", err)
		p.cleanupFailedMediaUpload(ctx, asset.ID, nil, "audio")
		return connect.NewError(connect.CodeInternal, err)
	}

	segments, tmpDir, err := vid.GenerateAudioSegments(
		f.Name(),
		audio.AssetID.String(),
		uploadSegmentLength,
		audioDuration,
	)
	if err != nil {
		slog.Error("error initializing audio segmenter", "error", err)
		p.cleanupFailedMediaUpload(ctx, asset.ID, nil, "audio")
		return connect.NewError(connect.CodeInternal, err)
	}
	defer os.RemoveAll(tmpDir)
	manifest := vid.StartManifest(
		audio.AssetID.String(),
		audio.AssetID,
		p.storageClient,
		p.queries,
		vid.IndexAudioSegment,
	)

	uploadedObjects, err := p.uploadSegments(
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
		p.cleanupFailedMediaUpload(ctx, asset.ID, uploadedObjects, "audio")
		return err
	}

	err = manifest.FinishUpload(ctx)
	manifestPath := fmt.Sprintf("manifests/%s.m3u8", audio.AssetID.String())
	if err != nil {
		slog.Error("error uploading manifest", "error", err)
		p.cleanupFailedMediaUpload(ctx, asset.ID, append(uploadedObjects, manifestPath), "audio")
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
		p.cleanupFailedMediaUpload(ctx, asset.ID, append(uploadedObjects, manifestPath), "audio")
		return err
	}
	return nil
}
