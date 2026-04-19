package project

import (
	"context"
	"encoding/json"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	v1 "vynfo.com/vynfo/gen/proto/v1"
)

func (p *ProjectServiceServer) GetCommit(
	ctx context.Context,
	req *connect.Request[v1.GetCommitRequest],
) (*connect.Response[v1.GetCommitResponse], error) {
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
	var sections []*v1.PlaybackSection
	if err := json.Unmarshal(commit.State, &sections); err != nil {
		slog.Error("error unmarshalling commit state", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&v1.GetCommitResponse{
		CommitId:    commit.ID.String(),
		ProjectId:   commit.ProjectID.String(),
		Message:     commit.Message.String,
		CommitState: sections,
	}), nil
}
