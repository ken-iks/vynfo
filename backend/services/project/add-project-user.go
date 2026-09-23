package project

import (
	"context"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/emptypb"
	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"
)

func (p *ProjectServiceServer) AddProjectUser(
	ctx context.Context,
	req *connect.Request[v1.AddProjectUserRequest],
) (*connect.Response[emptypb.Empty], error) {
	user, err := auth.RequireOnboardedUser(ctx, p.queries)
	if err != nil {
		return nil, err
	}
	logger := slog.Default().With(
		"user_id", user.ID.String(),
		"project_id", req.Msg.GetProjectId(),
		"added_user_id", req.Msg.GetUserId(),
	)

	projectId, err := uuid.Parse(req.Msg.GetProjectId())
	if err != nil {
		logger.ErrorContext(ctx, "error parsing project id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	userId, err := uuid.Parse(req.Msg.GetUserId())
	if err != nil {
		logger.ErrorContext(ctx, "error parsing user id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	if err := p.queries.AddProjectMember(ctx, db.AddProjectMemberParams{
		ProjectID: projectId,
		MemberID:  userId,
	}); err != nil {
		logger.ErrorContext(ctx, "error adding project member", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	logger.InfoContext(ctx, "project member added")

	return connect.NewResponse(&emptypb.Empty{}), nil
}
