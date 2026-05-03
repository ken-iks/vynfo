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
	if _, err := auth.RequireOnboardedUser(ctx, p.queries); err != nil {
		return nil, err
	}

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

	if err := p.queries.AddProjectMember(ctx, db.AddProjectMemberParams{
		ProjectID: projectId,
		MemberID:  userId,
	}); err != nil {
		slog.Error("error adding project member", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&emptypb.Empty{}), nil
}
