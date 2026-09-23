package users

import (
	"context"
	"log/slog"

	"connectrpc.com/connect"
	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	dbgen "vynfo.com/vynfo/internal/db"
)

func (s *UsersServiceServer) GetMe(
	ctx context.Context,
	req *connect.Request[v1.GetMeRequest],
) (*connect.Response[v1.GetMeResponse], error) {
	authUser, ok := auth.UserFromContext(ctx)
	if !ok {
		return nil, connect.NewError(connect.CodeUnauthenticated, nil)
	}

	if authUser.Email == "" {
		return nil, connect.NewError(connect.CodeUnauthenticated, nil)
	}

	user, err := s.queries.GetOrCreateUserByFirebaseId(ctx, dbgen.GetOrCreateUserByFirebaseIdParams{
		FirebaseUid: authUser.FirebaseUID,
		Email:       authUser.Email,
	})
	if err != nil {
		slog.Error("error getting or creating firebase user", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	responseUser, err := s.userResponse(
		user.ID.String(),
		user.Email,
		user.DisplayName,
		user.DisplayPhotoObjectPath,
	)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&v1.GetMeResponse{
		User:            responseUser,
		NeedsOnboarding: !user.OnboardedAt.Valid,
	}), nil
}
