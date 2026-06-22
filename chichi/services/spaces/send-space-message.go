package spaces

import (
	"context"
	"errors"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"
)

func (s *SpacesServiceServer) SendSpaceMessage(
	ctx context.Context,
	req *connect.Request[v1.SendSpaceMessageRequest],
) (*connect.Response[v1.SendSpaceMessageResponse], error) {
	spaceMessage := req.Msg.GetSpaceMessage()
	if spaceMessage == nil {
		return nil, connect.NewError(
			connect.CodeInvalidArgument,
			errors.New("space_message is required"),
		)
	}

	user, err := auth.RequireOnboardedUser(ctx, s.queries)
	if err != nil {
		return nil, err
	}
	logger := slog.Default().With(
		"user_id", user.ID.String(),
		"space_id", req.Msg.GetSpaceId(),
		"has_parent_message",
		req.Msg.GetParentMessageId() != "",
	)

	spaceId, err := uuid.Parse(req.Msg.GetSpaceId())
	if err != nil {
		logger.ErrorContext(ctx, "error parsing space id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	var parentId uuid.NullUUID
	if raw := req.Msg.GetParentMessageId(); raw != "" {
		parsed, err := uuid.Parse(raw)
		if err != nil {
			logger.ErrorContext(ctx, "error parsing parent message id", "error", err)
			return nil, connect.NewError(connect.CodeInvalidArgument, err)
		}
		parentId = uuid.NullUUID{UUID: parsed, Valid: true}
		logger = logger.With("parent_message_id", parsed.String())
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		logger.ErrorContext(ctx, "error beginning transaction", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	defer tx.Rollback()
	q := s.queries.WithTx(tx)

	var sentMessageId uuid.UUID
	if parentId.Valid {
		row, err := q.AddBranchedMessageToSpace(ctx, db.AddBranchedMessageToSpaceParams{
			SpaceID:  spaceId,
			AuthorID: user.ID,
			Body:     spaceMessage.GetContent(),
			ParentID: parentId,
		})
		if err != nil {
			logger.ErrorContext(ctx, "error inserting branched message", "error", err)
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		sentMessageId = row.ID
	} else {
		row, err := q.AddMessageToSpace(ctx, db.AddMessageToSpaceParams{
			SpaceID:  spaceId,
			AuthorID: user.ID,
			Body:     spaceMessage.GetContent(),
		})
		if err != nil {
			logger.ErrorContext(ctx, "error inserting message", "error", err)
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		sentMessageId = row.ID
	}

	if err := q.TouchSpace(ctx, spaceId); err != nil {
		logger.ErrorContext(ctx, "error touching space updated_at", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if err := q.TriggerSpaceNotification(ctx, spaceId.String()); err != nil {
		logger.ErrorContext(ctx, "error triggering space notification", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if err := tx.Commit(); err != nil {
		logger.ErrorContext(ctx, "error committing db transaction", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	logger.InfoContext(ctx, "space message sent", "message_id", sentMessageId.String())

	return connect.NewResponse(&v1.SendSpaceMessageResponse{
		SentMessageId: sentMessageId.String(),
	}), nil
}
