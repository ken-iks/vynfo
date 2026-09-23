package auth

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"vynfo.com/vynfo/internal/db"
	dbgen "vynfo.com/vynfo/internal/db"
)

func RequireOnboardedUser(ctx context.Context, queries *dbgen.Queries) (dbgen.User, error) {
	authUser, ok := UserFromContext(ctx)
	if !ok {
		slog.WarnContext(ctx, "auth user missing from context")
		return dbgen.User{}, connect.NewError(connect.CodeUnauthenticated, nil)
	}

	user, err := queries.GetUserFromFirebase(ctx, authUser.FirebaseUID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			slog.WarnContext(
				ctx,
				"firebase user not found in db",
				"firebase_uid",
				authUser.FirebaseUID,
			)
			return dbgen.User{}, connect.NewError(connect.CodeUnauthenticated, err)
		}
		slog.ErrorContext(
			ctx,
			"error fetching firebase user",
			"firebase_uid",
			authUser.FirebaseUID,
			"error",
			err,
		)
		return dbgen.User{}, connect.NewError(connect.CodeInternal, err)
	}

	if !user.OnboardedAt.Valid {
		slog.WarnContext(ctx, "user is not onboarded", "user_id", user.ID.String())
		return dbgen.User{}, connect.NewError(connect.CodePermissionDenied, nil)
	}

	return user, nil
}

func AssertUserInWorkspace(
	ctx context.Context,
	workspaceID uuid.UUID,
	queries *dbgen.Queries,
) error {
	authUser, ok := UserFromContext(ctx)
	if !ok {
		return connect.NewError(connect.CodeUnauthenticated, nil)
	}

	user, err := queries.GetUserFromFirebase(ctx, authUser.FirebaseUID)
	if err != nil {
		return connect.NewError(connect.CodeInternal, err)
	}

	isMember, err := queries.IsWorkspaceMember(ctx, db.IsWorkspaceMemberParams{
		WorkspaceID: workspaceID,
		MemberID:    user.ID,
	})
	if err != nil {
		return connect.NewError(connect.CodeInternal, err)
	}
	if !isMember {
		return connect.NewError(connect.CodePermissionDenied, nil)
	}
	return nil
}
