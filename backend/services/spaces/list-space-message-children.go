package spaces

import (
	"context"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	dbgen "vynfo.com/vynfo/internal/db"
)

func (s *SpacesServiceServer) ListSpaceMessageChildren(
	ctx context.Context,
	req *connect.Request[v1.ListSpaceMessageChildrenRequest],
) (*connect.Response[v1.ListSpaceMessagesResponse], error) {
	spaceId, err := uuid.Parse(req.Msg.GetSpaceId())
	if err != nil {
		slog.Error("error parsing space id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	parentId, err := uuid.Parse(req.Msg.GetMessageId())
	if err != nil {
		slog.Error("error parsing parent message id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	rows, err := s.queries.ListSpaceMessages(ctx, dbgen.ListSpaceMessagesParams{
		SpaceID:  spaceId,
		ParentID: uuid.NullUUID{UUID: parentId, Valid: true},
	})
	if err != nil {
		slog.Error("error fetching message children", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(toListSpaceMessagesResponse(rows)), nil
}
