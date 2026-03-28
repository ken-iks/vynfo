package services

import (
	"context"
	"fmt"
	"log/slog"
	"os"

	"cloud.google.com/go/storage"
	"connectrpc.com/connect"
	"github.com/google/uuid"

	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/gen/proto/v1/v1connect"

	vid "vynfo.com/vynfo/video"
)

type VideoServiceServer struct {
	v1connect.UnimplementedVideoServiceHandler
	storageClient *storage.Client
}

func NewVideoServiceServer(c *storage.Client) *VideoServiceServer {
	return &VideoServiceServer{storageClient: c}
}

func (v *VideoServiceServer) UploadVideo(
	ctx context.Context,
	req *connect.Request[v1.UploadVideoRequest],
	stream *connect.ServerStream[v1.UploadVideoResponse],
) error {
	bytes := req.Msg.GetContent()
	f, err := os.CreateTemp("external", "temp-*.mp4")
	if err != nil {
		slog.Error("error opening up temporary file for writing")
		return connect.NewError(connect.CodeInternal, err)
	}
	defer os.Remove(f.Name())
	defer f.Close()
	_, err = f.Write(bytes)
	if err != nil {
		slog.Error("error writing video to temp file")
		return connect.NewError(connect.CodeInvalidArgument, err)
	}
	videoId := uuid.NewString()
	segements, err := vid.GenerateSegments(f.Name(), videoId, 3)
	if err != nil {
		slog.Error("error initializing segemnter")
		return connect.NewError(connect.CodeInternal, err)
	}
	manifestFile, err := os.Create(fmt.Sprintf("%s.m3u8", videoId))
	if err != nil {
		slog.Error("error initializing local manifest")
		return connect.NewError(connect.CodeAborted, err)
	}
	defer manifestFile.Close()
	manifest := vid.StartManifest(videoId, manifestFile, v.storageClient)
	for seg, err := range segements {
		if err != nil {
			slog.Error("segmentation error")
			return connect.NewError(connect.CodeInternal, err)
		}
		if err := manifest.UploadSegment(seg, ctx); err != nil {
			slog.Error("error uploading segment", "percent", seg.PercentComplete, "error", err)
			return connect.NewError(connect.CodeInternal, err)
		}
		msg := &v1.UploadVideoResponse{
			UploadStatus: &v1.UploadVideoResponse_Ongoing{
				Ongoing: &v1.UploadProgressIndicator{
					VideoId:              videoId,
					CompletionPercentage: seg.PercentComplete,
				},
			},
		}
		if err := stream.Send(msg); err != nil {
			return err
		}
	}
	_, err = manifest.FinishUpload(ctx)
	if err != nil {
		slog.Error("error uploading manifest")
		return connect.NewError(connect.CodeInternal, err)
	}
	msg := &v1.UploadVideoResponse{
		UploadStatus: &v1.UploadVideoResponse_Finished{
			Finished: &v1.UploadFinishedIndicator{
				VideoId: videoId,
			},
		},
	}
	if err := stream.Send(msg); err != nil {
		return err
	}
	return nil
}
