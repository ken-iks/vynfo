package spaces

import (
	"context"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/timestamppb"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	dbgen "vynfo.com/vynfo/internal/db"
)

func (s *SpacesServiceServer) ListSpaceMessages(
	ctx context.Context,
	req *connect.Request[v1.ListSpaceMessagesRequest],
) (*connect.Response[v1.ListSpaceMessagesResponse], error) {
	spaceId, err := uuid.Parse(req.Msg.GetSpaceId())
	if err != nil {
		slog.Error("error parsing space id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	rows, err := s.queries.ListSpaceMessages(ctx, dbgen.ListSpaceMessagesParams{
		SpaceID:  spaceId,
		ParentID: uuid.NullUUID{},
	})
	if err != nil {
		slog.Error("error fetching space messages", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(toListSpaceMessagesResponse(rows)), nil
}

func toListSpaceMessagesResponse(rows []dbgen.ListSpaceMessagesRow) *v1.ListSpaceMessagesResponse {
	messages := make([]*v1.SpaceMessageWithMetadata, 0, len(rows))
	for _, row := range rows {
		messages = append(messages, &v1.SpaceMessageWithMetadata{
			MessageId: row.ID.String(),
			SpaceMessage: &v1.SpaceMessage{
				Content: row.Body,
				Author: &v1.User{
					UserId: row.AuthorID.String(),
					Email:  row.AuthorEmail,
				},
			},
			CreatedAt:  timestamppb.New(row.CreatedAt),
			ReplyCount: uint64(row.ReplyCount),
		})
	}
	return &v1.ListSpaceMessagesResponse{Messages: messages}
}
