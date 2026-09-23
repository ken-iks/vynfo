package project

import (
	"context"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/timestamppb"

	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"
)

func (p *ProjectServiceServer) ListCommits(
	ctx context.Context,
	req *connect.Request[v1.ListCommitsRequest],
) (*connect.Response[v1.ListCommitsResponse], error) {
	if _, err := auth.RequireOnboardedUser(ctx, p.queries); err != nil {
		return nil, err
	}

	projectID, err := uuid.Parse(req.Msg.GetProjectId())
	if err != nil {
		slog.Error("error parsing project id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	branchID, err := uuid.Parse(req.Msg.GetBranchId())
	if err != nil {
		slog.Error("error parsing branch id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	commits, err := p.queries.GetBranchCommitHistory(ctx, db.GetBranchCommitHistoryParams{
		ProjectID: projectID,
		ID:        branchID,
	})
	if err != nil {
		slog.Error("error fetching branch commits", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	out := make([]*v1.CommitMetadata, 0, len(commits))
	for _, commit := range commits {
		md := &v1.CommitMetadata{
			Id:        commit.ID.String(),
			ProjectId: commit.ProjectID.String(),
			UserId:    commit.UserID.String(),
			Message:   commit.Message.String,
		}
		if commit.CreatedAt.Valid {
			md.CreatedAt = timestamppb.New(commit.CreatedAt.Time)
		}
		out = append(out, md)
	}

	return connect.NewResponse(&v1.ListCommitsResponse{
		Commits: out,
	}), nil
}
