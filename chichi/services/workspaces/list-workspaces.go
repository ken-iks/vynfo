package workspaces

import (
	"context"
	"log/slog"

	"connectrpc.com/connect"
	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
)

func (w *WorkspacesServiceServer) ListWorkspaces(
	ctx context.Context,
	req *connect.Request[v1.ListWorkspacesRequest],
) (*connect.Response[v1.ListWorkspacesResponse], error) {
	user, err := auth.RequireOnboardedUser(ctx, w.queries)
	if err != nil {
		return nil, err
	}

	rows, err := w.queries.GetUserWorkspacesWithMembers(ctx, user.ID)
	if err != nil {
		slog.Error("error fetching user workspaces", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	workspacesById := make(map[string]*v1.Workspace)
	orderedIds := make([]string, 0)
	for _, row := range rows {
		workspaceID := row.WorkspaceID.String()
		workspace, ok := workspacesById[workspaceID]
		if !ok {
			workspace = userWorkspaceProto(row)
			workspacesById[workspaceID] = workspace
			orderedIds = append(orderedIds, workspaceID)
		}
		if row.MemberID.Valid {
			appendWorkspaceUser(
				workspace,
				row.MemberID.UUID.String(),
				row.MemberEmail.String,
				row.MemberDisplayName.String,
			)
		}
	}

	out := make([]*v1.Workspace, 0, len(orderedIds))
	for _, id := range orderedIds {
		out = append(out, workspacesById[id])
	}

	return connect.NewResponse(&v1.ListWorkspacesResponse{
		Workspaces: out,
	}), nil
}
