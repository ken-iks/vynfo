package users

import (
	"database/sql"
	"log/slog"
	"time"

	"cloud.google.com/go/storage"
	v1 "vynfo.com/vynfo/gen/proto/v1"
)

func (s *UsersServiceServer) userResponse(
	userID string,
	email string,
	displayName sql.NullString,
	displayPhotoObjectPath sql.NullString,
) (*v1.User, error) {
	responseUser := &v1.User{
		UserId: userID,
		Email:  email,
	}

	if displayName.Valid {
		responseUser.DisplayName = displayName.String
	}

	if displayPhotoObjectPath.Valid {
		signedURL, err := s.storageClient.Bucket("vedit-v1").SignedURL(
			displayPhotoObjectPath.String,
			&storage.SignedURLOptions{
				Method:  "GET",
				Expires: time.Now().Add(15 * time.Minute),
			},
		)
		if err != nil {
			slog.Error("error signing display photo url", "user_id", userID, "error", err)
			return nil, err
		}
		responseUser.SignedDisplayPhotoPath = signedURL
	}

	return responseUser, nil
}
