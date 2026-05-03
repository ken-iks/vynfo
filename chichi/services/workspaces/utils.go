package workspaces

import (
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"

	"google.golang.org/protobuf/types/known/timestamppb"
)

func workspaceProto(workspace db.Workspace) *v1.Workspace {
	out := &v1.Workspace{
		WorkspaceId: workspace.ID.String(),
		Name:        workspace.Name,
	}
	if workspace.CreatedAt.Valid {
		out.CreatedAt = timestamppb.New(workspace.CreatedAt.Time)
	}
	return out
}
