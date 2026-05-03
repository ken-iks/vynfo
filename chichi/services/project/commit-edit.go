package project

import (
	"context"
	"database/sql"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"google.golang.org/protobuf/encoding/protojson"
	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"
	"vynfo.com/vynfo/video"
)

func (p *ProjectServiceServer) CommitEdit(
	ctx context.Context,
	req *connect.Request[v1.CommitEditRequest],
) (*connect.Response[v1.CommitEditResponse], error) {
	projectId, err := uuid.Parse(req.Msg.GetProjectId())
	if err != nil {
		slog.Error("error parsing project id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	user, err := auth.RequireOnboardedUser(ctx, p.queries)
	if err != nil {
		return nil, err
	}
	currBranch, err := p.queries.GetBranchByName(ctx, db.GetBranchByNameParams{
		ProjectID: projectId,
		Name:      req.Msg.GetBranchName(),
	})
	if err != nil {
		slog.Error("error retrieve branch", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	prevCommitID := req.Msg.GetPreviousCommitId()
	if prevCommitID != "" && prevCommitID != currBranch.TipCommitID.UUID.String() {
		return connect.NewResponse(&v1.CommitEditResponse{
			Response: &v1.CommitEditResponse_Err{
				Err: &v1.CommitEditError{
					ErrorType: &v1.CommitEditError_StaleBranch{
						StaleBranch: &v1.StaleBranchError{
							AssumedBranchTipUuid: req.Msg.GetPreviousCommitId(),
							CurrentBranchTipUuid: currBranch.TipCommitID.UUID.String(),
						},
					},
				},
			},
		}), nil
	}
	// TODO authenticate that branch is part of the project
	state := req.Msg.GetCommitState()
	manifest, err := video.ParsePlaybackStateToHLS(ctx, p.queries, state)
	if err != nil {
		slog.Error("unable to parse playback state", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	err = video.UploadBranchManifestToCloud(ctx, p.storageClient, manifest, currBranch.ID.String())
	if err != nil {
		slog.Error("unable to write manifest to cloud", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if len(state.GetAudioSections()) > 0 {
		audioManifest, err := video.ParseAudioSectionsToHLS(
			ctx,
			p.queries,
			state.GetAudioSections(),
		)
		if err != nil {
			slog.Error("unable to parse audio playback state", "error", err)
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		err = video.UploadBranchAudioManifestToCloud(
			ctx,
			p.storageClient,
			audioManifest,
			currBranch.ID.String(),
		)
		if err != nil {
			slog.Error("unable to write audio manifest to cloud", "error", err)
			return nil, connect.NewError(connect.CodeInternal, err)
		}
	}
	stateJson, err := protojson.Marshal(&v1.CommitEditRequest{
		CommitState: state,
	})
	if err != nil {
		slog.Error("error serializing state to json", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	tx, err := p.db.BeginTx(ctx, nil)
	if err != nil {
		slog.Error("error starting transaction")
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	defer tx.Rollback()
	q := p.queries.WithTx(tx)
	commit, err := q.CreateCommit(ctx, db.CreateCommitParams{
		UserID:    user.ID,
		ProjectID: projectId,
		State:     stateJson,
		Message: sql.NullString{
			String: req.Msg.GetCommitMessage(),
			Valid:  req.Msg.GetCommitMessage() != "",
		},
	})
	if err != nil {
		slog.Error("error creating commit", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	updatedBranch, err := q.SetBranchCommitID(ctx, db.SetBranchCommitIDParams{
		TipCommitID: uuid.NullUUID{UUID: commit.ID, Valid: true},
		ID:          currBranch.ID,
	})
	if err != nil {
		slog.Error("error updating branch to new commit", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if err := tx.Commit(); err != nil {
		slog.Error("error commiting db transaction", "error", err)
	}

	p.manifestCache.DropBranch(user.ID.String(), currBranch.ID.String())
	return connect.NewResponse(&v1.CommitEditResponse{
		Response: &v1.CommitEditResponse_NewCommitId{
			NewCommitId: updatedBranch.TipCommitID.UUID.String(),
		},
	}), nil
}
