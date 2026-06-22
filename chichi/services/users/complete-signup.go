package users

import (
	"bytes"
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"connectrpc.com/connect"
	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	dbgen "vynfo.com/vynfo/internal/db"
	"vynfo.com/vynfo/shared"
)

func displayPhotoObjectPath(userID string) string {
	return fmt.Sprintf("users/%s/display-photo", userID)
}

func (s *UsersServiceServer) CompleteOnboarding(
	ctx context.Context,
	req *connect.Request[v1.CompleteOnboardingRequest],
) (*connect.Response[v1.CompleteOnboardingResponse], error) {
	authUser, ok := auth.UserFromContext(ctx)
	if !ok {
		return nil, connect.NewError(connect.CodeUnauthenticated, nil)
	}
	logger := slog.Default().With("firebase_uid", authUser.FirebaseUID)

	if authUser.Email == "" {
		return nil, connect.NewError(connect.CodeUnauthenticated, nil)
	}

	displayName := strings.TrimSpace(req.Msg.GetDisplayName())
	if displayName == "" {
		return nil, connect.NewError(
			connect.CodeInvalidArgument,
			fmt.Errorf("display name is required"),
		)
	}

	displayPhoto := req.Msg.GetDisplayPhoto()
	contentType := http.DetectContentType(displayPhoto)
	if !strings.HasPrefix(contentType, "image/") {
		return nil, connect.NewError(
			connect.CodeInvalidArgument,
			fmt.Errorf("content type %s is not an image", contentType),
		)
	}

	user, err := s.queries.GetOrCreateUserByFirebaseId(ctx, dbgen.GetOrCreateUserByFirebaseIdParams{
		FirebaseUid: authUser.FirebaseUID,
		Email:       authUser.Email,
	})
	if err != nil {
		logger.ErrorContext(ctx, "error getting or creating firebase user", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	logger = logger.With("user_id", user.ID.String())

	objectPath := displayPhotoObjectPath(user.ID.String())
	bucket := s.storageClient.Bucket("vedit-v1")
	writer := bucket.Object(objectPath).NewWriter(ctx)
	writer.ContentType = contentType
	if _, err := shared.UploadBytes(writer, bytes.NewReader(displayPhoto), objectPath, nil); err != nil {
		logger.ErrorContext(ctx, "error uploading display photo", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		logger.ErrorContext(ctx, "error beginning onboarding transaction", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	defer tx.Rollback()
	q := s.queries.WithTx(tx)

	updatedUser, err := q.FinishUserOnboarding(ctx, dbgen.FinishUserOnboardingParams{
		DisplayName: sql.NullString{
			String: displayName,
			Valid:  true,
		},
		DisplayPhotoObjectPath: sql.NullString{
			String: objectPath,
			Valid:  true,
		},
		OnboardedAt: sql.NullTime{
			Time:  time.Now(),
			Valid: true,
		},
		ID: user.ID,
	})
	if err != nil {
		logger.ErrorContext(ctx, "error finishing user onboarding", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	workspace, err := q.CreateWorkspace(ctx, fmt.Sprintf("%s's workspace", displayName))
	if err != nil {
		logger.ErrorContext(ctx, "error creating default workspace", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	logger = logger.With("workspace_id", workspace.ID.String())
	if err := q.AddWorkspaceMember(ctx, dbgen.AddWorkspaceMemberParams{
		WorkspaceID: workspace.ID,
		MemberID:    user.ID,
	}); err != nil {
		logger.ErrorContext(
			ctx,
			"error adding user to default workspace",
			"error",
			err,
		)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if err := tx.Commit(); err != nil {
		logger.ErrorContext(ctx, "error committing onboarding transaction", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	logger.InfoContext(
		ctx,
		"user onboarding completed",
		"display_photo_content_type",
		contentType,
	)

	responseUser, err := s.userResponse(
		updatedUser.ID.String(),
		updatedUser.Email,
		updatedUser.DisplayName,
		updatedUser.DisplayPhotoObjectPath,
	)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&v1.CompleteOnboardingResponse{
		User: responseUser,
	}), nil
}
