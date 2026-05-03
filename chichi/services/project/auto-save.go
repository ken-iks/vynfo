package project

import (
	"context"
	"log/slog"
	"time"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/emptypb"
	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/video"
)

func (p *ProjectServiceServer) AutoSave(
	ctx context.Context,
	req *connect.Request[v1.AutoSaveRequest],
) (*connect.Response[emptypb.Empty], error) {
	// TODO assert that branch is part of project
	user, err := auth.RequireOnboardedUser(ctx, p.queries)
	if err != nil {
		return nil, err
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

	state := req.Msg.GetAutoSaveState()
	manifest, err := video.ParsePlaybackStateToHLS(ctx, p.queries, state)
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
	p.manifestCache.Add(
		user.ID.String(),
		branchID.String(),
		video.ManifestKindVideo,
		signed,
		time.Until(expiry),
	)
	if len(state.GetAudioSections()) == 0 {
		p.manifestCache.Drop(user.ID.String(), branchID.String(), video.ManifestKindAudio)
		return connect.NewResponse(&emptypb.Empty{}), nil
	}
	audioManifest, err := video.ParseAudioSectionsToHLS(ctx, p.queries, state.GetAudioSections())
	if err != nil {
		slog.Error("unable to parse audio playback state", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	signedAudio, err := video.SignManifest(
		p.storageClient.Bucket("vedit-v1"),
		audioManifest,
		expiry,
	)
	if err != nil {
		slog.Error("unable to sign generated audio manifest", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	p.manifestCache.Add(
		user.ID.String(),
		branchID.String(),
		video.ManifestKindAudio,
		signedAudio,
		time.Until(expiry),
	)
	return connect.NewResponse(&emptypb.Empty{}), nil
}
