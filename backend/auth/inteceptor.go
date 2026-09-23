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

type firebaseInterceptor struct {
	client *fbauth.Client
}

// FirebaseInterceptor verifies Firebase ID tokens and adds the auth user to
// the request context for every RPC shape. Connect's UnaryInterceptorFunc does
// not run for streaming endpoints, so uploads need the full Interceptor methods
// to authenticate both regular requests and server-streaming handlers.
func FirebaseInterceptor(client *fbauth.Client) connect.Interceptor {
	return firebaseInterceptor{client: client}
}

func (i firebaseInterceptor) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
	return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		ctx, err := i.authenticate(ctx, req.Header().Get("Authorization"))
		if err != nil {
			return nil, err
		}
		return next(ctx, req)
	}
}

func (i firebaseInterceptor) WrapStreamingHandler(
	next connect.StreamingHandlerFunc,
) connect.StreamingHandlerFunc {
	return func(ctx context.Context, conn connect.StreamingHandlerConn) error {
		ctx, err := i.authenticate(ctx, conn.RequestHeader().Get("Authorization"))
		if err != nil {
			return err
		}
		return next(ctx, conn)
	}
}

func (i firebaseInterceptor) WrapStreamingClient(
	next connect.StreamingClientFunc,
) connect.StreamingClientFunc {
	return next
}

func (i firebaseInterceptor) authenticate(
	ctx context.Context,
	header string,
) (context.Context, error) {
	rawToken := strings.TrimPrefix(header, "Bearer ")
	if rawToken == "" || rawToken == header {
		return ctx, connect.NewError(connect.CodeUnauthenticated, nil)
	}

	decoded, err := i.client.VerifyIDToken(ctx, rawToken)
	if err != nil {
		return ctx, connect.NewError(connect.CodeUnauthenticated, err)
	}

	email, _ := decoded.Claims["email"].(string)
	return context.WithValue(ctx, UserKey, User{
		FirebaseUID: decoded.UID,
		Email:       email,
	}), nil
}

func UserFromContext(ctx context.Context) (User, bool) {
	user, ok := ctx.Value(UserKey).(User)
	return user, ok
}
