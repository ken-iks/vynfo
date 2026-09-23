package workspaces

import (
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"

	"google.golang.org/protobuf/types/known/timestamppb"
)

func workspaceProto(workspace db.GetWorkspaceWithMembersRow) *v1.Workspace {
	out := &v1.Workspace{
		WorkspaceId: workspace.WorkspaceID.String(),
		Name:        workspace.WorkspaceName,
		Users:       make([]*v1.User, 0),
	}
	if workspace.WorkspaceCreatedAt.Valid {
		out.CreatedAt = timestamppb.New(workspace.WorkspaceCreatedAt.Time)
	}
	return out
}

func userWorkspaceProto(workspace db.GetUserWorkspacesWithMembersRow) *v1.Workspace {
	out := &v1.Workspace{
		WorkspaceId: workspace.WorkspaceID.String(),
		Name:        workspace.WorkspaceName,
		Users:       make([]*v1.User, 0),
	}
	if workspace.WorkspaceCreatedAt.Valid {
		out.CreatedAt = timestamppb.New(workspace.WorkspaceCreatedAt.Time)
	}
	return out
}

func appendWorkspaceUser(
	workspace *v1.Workspace,
	memberID string,
	email string,
	displayName string,
) {
	user := &v1.User{
		UserId: memberID,
		Email:  email,
	}
	if displayName != "" {
		user.DisplayName = displayName
	}
	workspace.Users = append(workspace.Users, user)
}
