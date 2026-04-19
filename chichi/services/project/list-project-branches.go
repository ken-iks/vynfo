package project

import (
	"context"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"

	v1 "vynfo.com/vynfo/gen/proto/v1"
)

func (p *ProjectServiceServer) ListProjectBranches(
	ctx context.Context,
	req *connect.Request[v1.ListProjectBranchesRequest],
) (*connect.Response[v1.ListProjectBranchesResponse], error) {
	projectID, err := uuid.Parse(req.Msg.GetProjectId())
	if err != nil {
		slog.Error("error parsing project id")
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	branches, err := p.queries.ListProjectBranches(ctx, projectID)
	if err != nil {
		slog.Error("error fetching project branches", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	out := make([]*v1.BranchMetadata, 0, len(branches))
	for _, b := range branches {
		md := &v1.BranchMetadata{
			Name: b.Name,
		}
		if b.TipCommitID.Valid {
			tipID := b.TipCommitID.UUID.String()
			md.TipCommitId = &tipID
		}
		out = append(out, md)
	}

	return connect.NewResponse(&v1.ListProjectBranchesResponse{
		Branches: out,
	}), nil
}
