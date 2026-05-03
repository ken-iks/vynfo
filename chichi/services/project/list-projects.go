package project

import (
	"context"
	"log/slog"

	"connectrpc.com/connect"
	"google.golang.org/protobuf/types/known/timestamppb"

	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"
)

func (p *ProjectServiceServer) ListProjects(
	ctx context.Context,
	req *connect.Request[v1.ListProjectsRequest],
) (*connect.Response[v1.ListProjectsResponse], error) {
	user, err := auth.RequireOnboardedUser(ctx, p.queries)
	if err != nil {
		return nil, err
	}

	userCreatedProjects, err := p.queries.GetUserCreatedProjects(ctx, user.ID)
	if err != nil {
		slog.Error("error fetching user created projects", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	userMemberProjects, err := p.queries.GetUserMemberProjects(ctx, user.ID)
	if err != nil {
		slog.Error("error fetching user member projects", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&v1.ListProjectsResponse{
		UserCreatedProjects: projectMetadata(userCreatedProjects),
		UserMemberProjects:  projectMetadata(userMemberProjects),
	}), nil
}

func projectMetadata(projects []db.Project) []*v1.ProjectMetadata {
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
	return out
}
