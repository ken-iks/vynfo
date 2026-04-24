package spaces

import (
	"context"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	v1 "vynfo.com/vynfo/gen/proto/v1"
)

func (s *SpacesServiceServer) ListSpaces(
	ctx context.Context,
	req *connect.Request[v1.ListSpacesRequest],
) (*connect.Response[v1.ListSpacesResponse], error) {
	projectId, err := uuid.Parse(req.Msg.GetProjectId())
	if err != nil {
		slog.Error("error parsing project id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	rows, err := s.queries.GetProjectSpacesWithMembers(ctx, projectId)
	if err != nil {
		slog.Error("error fetching project spaces", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	spacesById := make(map[uuid.UUID]*v1.ProjectSpace)
	orderedIds := make([]uuid.UUID, 0)
	for _, row := range rows {
		space, ok := spacesById[row.SpaceID]
		if !ok {
			space = &v1.ProjectSpace{
				SpaceId:     row.SpaceID.String(),
				ProjectId:   row.ProjectID.String(),
				AdminUserId: row.AdminID.String(),
				Users:       make([]*v1.User, 0),
			}
			spacesById[row.SpaceID] = space
			orderedIds = append(orderedIds, row.SpaceID)
		}
		if row.MemberID.Valid {
			space.Users = append(space.Users, &v1.User{
				UserId: row.MemberID.UUID.String(),
				Email:  row.MemberEmail.String,
			})
		}
	}

	result := make([]*v1.ProjectSpace, 0, len(orderedIds))
	for _, id := range orderedIds {
		result = append(result, spacesById[id])
	}

	return connect.NewResponse(&v1.ListSpacesResponse{
		Spaces: result,
	}), nil
}
