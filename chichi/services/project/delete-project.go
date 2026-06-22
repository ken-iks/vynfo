package project

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/emptypb"
	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"
)

func (p *ProjectServiceServer) DeleteProject(
	ctx context.Context,
	req *connect.Request[v1.DeleteProjectRequest],
) (*connect.Response[emptypb.Empty], error) {
	logger := slog.Default().With("project_id", req.Msg.GetProjectId())
	projectId, err := uuid.Parse(req.Msg.GetProjectId())
	if err != nil {
		logger.ErrorContext(ctx, "error parsing project id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	user, err := auth.RequireOnboardedUser(ctx, p.queries)
	if err != nil {
		return nil, err
	}
	logger = logger.With("user_id", user.ID.String())

	project, err := p.queries.GetProject(ctx, projectId)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		logger.ErrorContext(ctx, "error fetching project", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if project.UserID != user.ID {
		return nil, connect.NewError(connect.CodePermissionDenied, nil)
	}

	deletedRows, err := p.queries.DeleteProject(ctx, db.DeleteProjectParams{
		ID:     projectId,
		UserID: user.ID,
	})
	if err != nil {
		logger.ErrorContext(ctx, "error deleting project", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if deletedRows == 0 {
		return nil, connect.NewError(connect.CodeNotFound, sql.ErrNoRows)
	}
	logger.InfoContext(ctx, "project deleted")

	return connect.NewResponse(&emptypb.Empty{}), nil
}
