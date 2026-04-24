package spaces

import (
	"context"
	"errors"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"
)

func (s *SpacesServiceServer) SendSpaceMessage(
	ctx context.Context,
	req *connect.Request[v1.SendSpaceMessageRequest],
) (*connect.Response[v1.SendSpaceMessageResponse], error) {
	spaceMessage := req.Msg.GetSpaceMessage()
	if spaceMessage == nil || spaceMessage.GetAuthor() == nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("space_message and author are required"))
	}

	spaceId, err := uuid.Parse(req.Msg.GetSpaceId())
	if err != nil {
		slog.Error("error parsing space id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	authorId, err := uuid.Parse(spaceMessage.GetAuthor().GetUserId())
	if err != nil {
		slog.Error("error parsing author id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	var parentId uuid.NullUUID
	if raw := req.Msg.GetParentMessageId(); raw != "" {
		parsed, err := uuid.Parse(raw)
		if err != nil {
			slog.Error("error parsing parent message id", "error", err)
			return nil, connect.NewError(connect.CodeInvalidArgument, err)
		}
		parentId = uuid.NullUUID{UUID: parsed, Valid: true}
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		slog.Error("error beginning transaction", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	defer tx.Rollback()
	q := s.queries.WithTx(tx)

	var sentMessageId uuid.UUID
	if parentId.Valid {
		row, err := q.AddBranchedMessageToSpace(ctx, db.AddBranchedMessageToSpaceParams{
			SpaceID:  spaceId,
			AuthorID: authorId,
			Body:     spaceMessage.GetContent(),
			ParentID: parentId,
		})
		if err != nil {
			slog.Error("error inserting branched message", "error", err)
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		sentMessageId = row.ID
	} else {
		row, err := q.AddMessageToSpace(ctx, db.AddMessageToSpaceParams{
			SpaceID:  spaceId,
			AuthorID: authorId,
			Body:     spaceMessage.GetContent(),
		})
		if err != nil {
			slog.Error("error inserting message", "error", err)
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		sentMessageId = row.ID
	}

	if err := q.TriggerSpaceNotification(ctx, spaceId.String()); err != nil {
		slog.Error("error triggering space notification", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if err := tx.Commit(); err != nil {
		slog.Error("error committing db transaction", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&v1.SendSpaceMessageResponse{
		SentMessageId: sentMessageId.String(),
	}), nil
}
