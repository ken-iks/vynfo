package project

import (
	"context"
	"log/slog"
	"time"

	"cloud.google.com/go/storage"
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
	_, err := auth.RequireOnboardedUser(ctx, p.queries)
	if err != nil {
		return nil, err
	}
	workspaceID, err := uuid.Parse(req.Msg.GetWorkspaceId())
	if err != nil {
		slog.Error("error parsing workspace id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	projects, err := p.queries.GetWorkspaceProjectsWithCreators(ctx, workspaceID)
	if err != nil {
		slog.Error("error fetching workspace projects", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	projectMetadata, err := p.projectMetadata(projects)
	if err != nil {
		slog.Error("error creating project metadata", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&v1.ListProjectsResponse{
		Projects: projectMetadata,
	}), nil
}

func (p *ProjectServiceServer) projectMetadata(
	projects []db.GetWorkspaceProjectsWithCreatorsRow,
) ([]*v1.ProjectMetadata, error) {
	out := make([]*v1.ProjectMetadata, 0, len(projects))
	for _, proj := range projects {
		createdBy, err := p.projectCreator(proj)
		if err != nil {
			return nil, err
		}
		md := &v1.ProjectMetadata{
			Id:          proj.ID.String(),
			WorkspaceId: proj.WorkspaceID.String(),
			Name:        proj.ProjectName,
			Description: proj.ProjectDescription,
			CreatedBy:   createdBy,
		}
		if proj.CreatedAt.Valid {
			md.CreatedAt = timestamppb.New(proj.CreatedAt.Time)
		}
		out = append(out, md)
	}
	return out, nil
}

func (p *ProjectServiceServer) projectCreator(
	project db.GetWorkspaceProjectsWithCreatorsRow,
) (*v1.User, error) {
	user := &v1.User{
		UserId: project.UserID.String(),
		Email:  project.CreatorEmail,
	}
	if project.CreatorDisplayName.Valid {
		user.DisplayName = project.CreatorDisplayName.String
	}
	if project.CreatorDisplayPhotoObjectPath.Valid {
		signedURL, err := p.storageClient.Bucket("vedit-v1").SignedURL(
			project.CreatorDisplayPhotoObjectPath.String,
			&storage.SignedURLOptions{
				Method:  "GET",
				Expires: time.Now().Add(15 * time.Minute),
			},
		)
		if err != nil {
			return nil, err
		}
		user.SignedDisplayPhotoPath = signedURL
	}
	return user, nil
}
