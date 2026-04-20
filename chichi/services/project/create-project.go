package project

import (
	"context"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"
)

func (p *ProjectServiceServer) CreateProject(
	ctx context.Context,
	req *connect.Request[v1.CreateProjectRequest],
) (*connect.Response[v1.CreateProjectResponse], error) {
	userId, err := uuid.Parse(req.Msg.GetUserId())
	if err != nil {
		slog.Error("error parsing user id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	tx, err := p.db.BeginTx(ctx, nil)
	if err != nil {
		slog.Error("error beginning transaction", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	defer tx.Rollback()
	q := p.queries.WithTx(tx)

	project, err := q.CreateProject(ctx, db.CreateProjectParams{
		UserID: userId,
		ProjectName: req.Msg.GetProjectName(),
		ProjectDescription: req.Msg.GetProjectDescription(),
	})
	if err != nil {
		slog.Error("error creating project row", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	main, err := q.CreateMainBranch(ctx, project.ID)
	if err != nil {
		slog.Error("error creating main branch", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	updatedProject, err:= q.SetMainBranch(ctx, db.SetMainBranchParams{
		ID: project.ID,
		MainBranchID: uuid.NullUUID{ UUID: main.ID, Valid: true },
	})
	if err != nil {
		slog.Error("error updating main branch id", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if err := tx.Commit(); err != nil {
		slog.Error("error commiting db transaction", "error", err)
	}

	return connect.NewResponse(&v1.CreateProjectResponse{
		CreatedProjectId: updatedProject.ID.String(),
	}), nil
}