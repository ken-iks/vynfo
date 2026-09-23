package spaces

import (
	"context"
	"log/slog"

	"connectrpc.com/connect"
	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
)

func (s *SpacesServiceServer) OpenSpace(
	ctx context.Context,
	req *connect.Request[v1.OpenSpaceRequest],
	stream *connect.ServerStream[v1.OpenSpaceResponse],
) error {
	user, err := auth.RequireOnboardedUser(ctx, s.queries)
	if err != nil {
		return err
	}
	logger := slog.Default().With(
		"user_id", user.ID.String(),
		"space_id", req.Msg.GetSpaceId(),
	)
	logger.InfoContext(ctx, "space stream opened")

	ch, unsubscribe := s.observer.Subscribe(user.ID.String(), req.Msg.GetSpaceId())
	defer func() {
		unsubscribe()
		logger.InfoContext(ctx, "space stream closed")
	}()

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ch:
			if err := stream.Send(&v1.OpenSpaceResponse{
				NewMessageAlert: true,
			}); err != nil {
				logger.ErrorContext(ctx, "error sending space stream notification", "error", err)
				return err
			}
		}
	}
}
