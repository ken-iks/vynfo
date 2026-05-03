package auth

import (
	"context"
	"database/sql"
	"errors"

	"connectrpc.com/connect"
	dbgen "vynfo.com/vynfo/internal/db"
)

func RequireOnboardedUser(ctx context.Context, queries *dbgen.Queries) (dbgen.User, error) {
	authUser, ok := UserFromContext(ctx)
	if !ok {
		return dbgen.User{}, connect.NewError(connect.CodeUnauthenticated, nil)
	}

	user, err := queries.GetUserFromFirebase(ctx, authUser.FirebaseUID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return dbgen.User{}, connect.NewError(connect.CodeUnauthenticated, err)
		}
		return dbgen.User{}, connect.NewError(connect.CodeInternal, err)
	}

	if !user.OnboardedAt.Valid {
		return dbgen.User{}, connect.NewError(connect.CodePermissionDenied, nil)
	}

	return user, nil
}
