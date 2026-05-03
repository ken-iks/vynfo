package auth

import (
	"context"
	"strings"

	"connectrpc.com/connect"
	fbauth "firebase.google.com/go/v4/auth"
)

type contextKey string

const UserKey contextKey = "user"

type User struct {
	FirebaseUID string
	Email       string
}

func FirebaseInterceptor(client *fbauth.Client) connect.UnaryInterceptorFunc {
	return func(next connect.UnaryFunc) connect.UnaryFunc {
		return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
			header := req.Header().Get("Authorization")
			rawToken := strings.TrimPrefix(header, "Bearer ")

			if rawToken == "" || rawToken == header {
				return nil, connect.NewError(connect.CodeUnauthenticated, nil)
			}

			decoded, err := client.VerifyIDToken(ctx, rawToken)
			if err != nil {
				return nil, connect.NewError(connect.CodeUnauthenticated, err)
			}

			email, _ := decoded.Claims["email"].(string)

			ctx = context.WithValue(ctx, UserKey, User{
				FirebaseUID: decoded.UID,
				Email:       email,
			})

			return next(ctx, req)
		}
	}
}

func UserFromContext(ctx context.Context) (User, bool) {
	user, ok := ctx.Value(UserKey).(User)
	return user, ok
}
