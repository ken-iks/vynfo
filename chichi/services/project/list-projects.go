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

func (p *ProjectServiceServer) ListProjects(
	ctx context.Context,
	req *connect.Request[v1.ListProjectsRequest],
) (*connect.Response[v1.ListProjectsResponse], error) {
	user, err := auth.RequireOnboardedUser(ctx, p.queries)
	if err != nil {
		return nil, err
	}
	workspaceID, err := uuid.Parse(req.Msg.GetWorkspaceId())
	if err != nil {
		slog.Error("error parsing workspace id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	projects, err := p.queries.GetWorkspaceProjects(ctx, workspaceID)
	if err != nil {
		slog.Error("error fetching workspace projects", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	userCreatedProjects := make([]db.Project, 0)
	userMemberProjects := make([]db.Project, 0)
	for _, project := range projects {
		if project.UserID == user.ID {
			userCreatedProjects = append(userCreatedProjects, project)
			continue
		}
		userMemberProjects = append(userMemberProjects, project)
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
			WorkspaceId: proj.WorkspaceID.String(),
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
