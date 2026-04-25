package users

import (
	"context"
	"log/slog"

	"connectrpc.com/connect"
	v1 "vynfo.com/vynfo/gen/proto/v1"
)

func (s *UsersServiceServer) ListUsers(
	ctx context.Context,
	req *connect.Request[v1.ListUsersRequest],
) (*connect.Response[v1.ListUsersResponse], error) {
	rows, err := s.queries.ListUsers(ctx)
	if err != nil {
		slog.Error("error listing users", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	users := make([]*v1.User, 0, len(rows))
	for _, row := range rows {
		users = append(users, &v1.User{
			UserId: row.ID.String(),
			Email:  row.Email,
		})
	}

	return connect.NewResponse(&v1.ListUsersResponse{
		Users: users,
	}), nil
}
