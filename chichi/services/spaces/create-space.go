package spaces

import (
	"context"
	"errors"
	"log/slog"
	"strings"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"
)

func (s *SpacesServiceServer) CreateSpace(
	ctx context.Context,
	req *connect.Request[v1.CreateSpaceRequest],
) (*connect.Response[v1.CreateSpaceResponse], error) {
	user, err := auth.RequireOnboardedUser(ctx, s.queries)
	if err != nil {
		return nil, err
	}
	projectId, err := uuid.Parse(req.Msg.GetProjectId())
	if err != nil {
		slog.Error("error parsing project id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	name := strings.TrimSpace(req.Msg.GetName())
	if name == "" {
		return nil, connect.NewError(
			connect.CodeInvalidArgument,
			errors.New("space name is required"),
		)
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		slog.Error("error beginning transaction", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	defer tx.Rollback()
	q := s.queries.WithTx(tx)

	space, err := q.CreateSpace(ctx, db.CreateSpaceParams{
		ProjectID: projectId,
		AdminID:   user.ID,
		Name:      name,
	})
	if err != nil {
		slog.Error("error creating space row", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if err := q.AddSpaceMember(ctx, db.AddSpaceMemberParams{
		SpaceID:  space.ID,
		MemberID: user.ID,
	}); err != nil {
		slog.Error("error adding admin as space member", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if err := tx.Commit(); err != nil {
		slog.Error("error committing db transaction", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&v1.CreateSpaceResponse{
		CreatedSpaceId: space.ID.String(),
	}), nil
}
