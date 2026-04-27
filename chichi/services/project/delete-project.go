package project

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/emptypb"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"
)

func (p *ProjectServiceServer) DeleteProject(
	ctx context.Context,
	req *connect.Request[v1.DeleteProjectRequest],
) (*connect.Response[emptypb.Empty], error) {
	projectId, err := uuid.Parse(req.Msg.GetProjectId())
	if err != nil {
		slog.Error("error parsing project id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	userId, err := uuid.Parse(req.Msg.GetUserId())
	if err != nil {
		slog.Error("error parsing user id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	project, err := p.queries.GetProject(ctx, projectId)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		slog.Error("error fetching project", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if project.UserID != userId {
		return nil, connect.NewError(connect.CodePermissionDenied, nil)
	}

	deletedRows, err := p.queries.DeleteProject(ctx, db.DeleteProjectParams{
		ID:     projectId,
		UserID: userId,
	})
	if err != nil {
		slog.Error("error deleting project", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if deletedRows == 0 {
		return nil, connect.NewError(connect.CodeNotFound, sql.ErrNoRows)
	}

	return connect.NewResponse(&emptypb.Empty{}), nil
}
