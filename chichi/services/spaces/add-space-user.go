package spaces

import (
	"context"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/emptypb"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"
)

func (s *SpacesServiceServer) AddSpaceUser(
	ctx context.Context,
	req *connect.Request[v1.AddSpaceUserRequest],
) (*connect.Response[emptypb.Empty], error) {
	spaceId, err := uuid.Parse(req.Msg.GetSpaceId())
	if err != nil {
		slog.Error("error parsing space id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	userId, err := uuid.Parse(req.Msg.GetUserId())
	if err != nil {
		slog.Error("error parsing user id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	if err := s.queries.AddSpaceMember(ctx, db.AddSpaceMemberParams{
		SpaceID:  spaceId,
		MemberID: userId,
	}); err != nil {
		slog.Error("error adding space member", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&emptypb.Empty{}), nil
}
