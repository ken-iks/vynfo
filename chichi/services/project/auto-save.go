package project

import (
	"context"
	"log/slog"
	"time"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/emptypb"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/video"
)

func (p *ProjectServiceServer) AutoSave(
	ctx context.Context,
	req *connect.Request[v1.AutoSaveRequest],
) (*connect.Response[emptypb.Empty], error) {
	// TODO assert that branch is part of project
	_, err := uuid.Parse(req.Msg.GetUserId())
	if err != nil {
		slog.Error("error parsing user id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	_, err = uuid.Parse(req.Msg.GetProjectId())
	if err != nil {
		slog.Error("error parsing project id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	branchID, err := uuid.Parse(req.Msg.GetBranchId())
	if err != nil {
		slog.Error("error parsing branch id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	manifest, err := video.ParsePlaybackStateToHLS(ctx, p.queries, req.Msg.GetAutoSaveState())
	if err != nil {
		slog.Error("unable to parse playback state", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	expiry := time.Now().Add(15 * time.Minute)
	signed, err := video.SignManifest(p.storageClient.Bucket("vedit-v1"), manifest, expiry)
	if err != nil {
		slog.Error("unable to sign generated manifest", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	p.manifestCache.Add(req.Msg.GetUserId(), branchID.String(), signed, time.Until(expiry))
	return connect.NewResponse(&emptypb.Empty{}), nil
}
