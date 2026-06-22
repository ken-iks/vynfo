package spaces

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

func (s *SpacesServiceServer) AddSpaceUser(
	ctx context.Context,
	req *connect.Request[v1.AddSpaceUserRequest],
) (*connect.Response[emptypb.Empty], error) {
	user, err := auth.RequireOnboardedUser(ctx, s.queries)
	if err != nil {
		return nil, err
	}
	logger := slog.Default().With(
		"user_id", user.ID.String(),
		"space_id", req.Msg.GetSpaceId(),
		"added_user_id", req.Msg.GetUserId(),
	)

	spaceId, err := uuid.Parse(req.Msg.GetSpaceId())
	if err != nil {
		logger.ErrorContext(ctx, "error parsing space id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	userId, err := uuid.Parse(req.Msg.GetUserId())
	if err != nil {
		logger.ErrorContext(ctx, "error parsing user id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	if err := s.queries.AddSpaceMember(ctx, db.AddSpaceMemberParams{
		SpaceID:  spaceId,
		MemberID: userId,
	}); err != nil {
		logger.ErrorContext(ctx, "error adding space member", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	logger.InfoContext(ctx, "space member added")

	return connect.NewResponse(&emptypb.Empty{}), nil
}
