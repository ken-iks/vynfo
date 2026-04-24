package spaces

import (
	"context"

	"connectrpc.com/connect"
	v1 "vynfo.com/vynfo/gen/proto/v1"
)

func (s *SpacesServiceServer) OpenSpace(
	ctx context.Context,
	req *connect.Request[v1.OpenSpaceRequest],
	stream *connect.ServerStream[v1.OpenSpaceResponse],
) error {
	ch, unsubscribe := s.observer.Subscribe(req.Msg.GetUserId(), req.Msg.GetSpaceId())
	defer unsubscribe()

	for {
		select {
		case <- ctx.Done():
			return nil
		case <-ch:
			if err := stream.Send(&v1.OpenSpaceResponse{
				NewMessageAlert: true,
			}); err != nil {
				return err
			}
		}
	}
}