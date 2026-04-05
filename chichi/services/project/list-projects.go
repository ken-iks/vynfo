package project

import (
	"context"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/timestamppb"

	v1 "vynfo.com/vynfo/gen/proto/v1"
)

func (p *ProjectServiceServer) ListProjects(
	ctx context.Context,
	req *connect.Request[v1.ListProjectsRequest],
) (*connect.Response[v1.ListProjectsResponse], error) {
	userID, err := uuid.Parse(req.Msg.GetUserId())
	if err != nil {
		slog.Error("error parsing user id")
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	projects, err := p.queries.GetUserProjects(ctx, userID)
	if err != nil {
		slog.Error("error fetching user projects", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	out := make([]*v1.ProjectMetadata, 0, len(projects))
	for _, proj := range projects {
		md := &v1.ProjectMetadata{
			Id:          proj.ID.String(),
			Name:        proj.ProjectName,
			Description: proj.ProjectDescription,
		}
		if proj.CreatedAt.Valid {
			md.CreatedAt = timestamppb.New(proj.CreatedAt.Time)
		}
		out = append(out, md)
	}

	return connect.NewResponse(&v1.ListProjectsResponse{
		Projects: out,
	}), nil
}
