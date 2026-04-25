package users

import (
	"context"
	"log/slog"

	"connectrpc.com/connect"
	v1 "vynfo.com/vynfo/gen/proto/v1"
)

func (s *UsersServiceServer) CreateUser(
	ctx context.Context,
	req *connect.Request[v1.CreateUserRequest],
) (*connect.Response[v1.CreateUserResponse], error) {
	user, err := s.queries.CreateUser(ctx, req.Msg.GetEmail())
	if err != nil {
		slog.Error("error creating user", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&v1.CreateUserResponse{
		CreatedUserId: user.ID.String(),
	}), nil
}
