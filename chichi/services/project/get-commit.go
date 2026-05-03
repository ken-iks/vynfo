package project

import (
	"context"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"google.golang.org/protobuf/encoding/protojson"
	v1 "vynfo.com/vynfo/gen/proto/v1"
)

func (p *ProjectServiceServer) GetCommit(
	ctx context.Context,
	req *connect.Request[v1.GetCommitRequest],
) (*connect.Response[v1.GetCommitResponse], error) {
	_, err := uuid.Parse(req.Msg.GetUserId())
	if err != nil {
		slog.Error("error parsing user id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	commitID, err := uuid.Parse(req.Msg.GetCommitId())
	if err != nil {
		slog.Error("error parsing commit id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	commit, err := p.queries.GetCommitByID(ctx, commitID)
	if err != nil {
		slog.Error("error fetching commit", "error", err)
		return nil, connect.NewError(connect.CodeNotFound, err)
	}
	var state v1.CommitEditRequest
	if err := protojson.Unmarshal(commit.State, &state); err != nil {
		slog.Error("error unmarshalling commit state", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	branchID, err := uuid.Parse(req.Msg.GetBranchId())
	if err != nil {
		slog.Error("error parsing branch id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	p.manifestCache.DropBranch(req.Msg.GetUserId(), branchID.String())
	return connect.NewResponse(&v1.GetCommitResponse{
		CommitId:    commit.ID.String(),
		ProjectId:   commit.ProjectID.String(),
		Message:     commit.Message.String,
		CommitState: state.GetCommitState(),
	}), nil
}
