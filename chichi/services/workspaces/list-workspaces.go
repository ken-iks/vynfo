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

	workspaces, err := w.queries.GetUserWorkspaces(ctx, user.ID)
	if err != nil {
		slog.Error("error fetching user workspaces", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	out := make([]*v1.Workspace, 0, len(workspaces))
	for _, workspace := range workspaces {
		out = append(out, workspaceProto(workspace))
	}

	return connect.NewResponse(&v1.ListWorkspacesResponse{
		Workspaces: out,
	}), nil
}
