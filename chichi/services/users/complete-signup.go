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
		slog.Error("error getting or creating firebase user", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	objectPath := displayPhotoObjectPath(user.ID.String())
	bucket := s.storageClient.Bucket("vedit-v1")
	writer := bucket.Object(objectPath).NewWriter(ctx)
	writer.ContentType = contentType
	if _, err := shared.UploadBytes(writer, bytes.NewReader(displayPhoto), objectPath, nil); err != nil {
		slog.Error("error uploading display photo", "user_id", user.ID, "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	updatedUser, err := s.queries.FinishUserOnboarding(ctx, dbgen.FinishUserOnboardingParams{
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
		slog.Error("error finishing user onboarding", "user_id", user.ID, "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

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
