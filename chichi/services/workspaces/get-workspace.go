package workspaces

import (
	"context"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
)

func (w *WorkspacesServiceServer) GetWorkspace(
	ctx context.Context,
	req *connect.Request[v1.GetWorkspaceRequest],
) (*connect.Response[v1.GetWorkspaceResponse], error) {
	if _, err := auth.RequireOnboardedUser(ctx, w.queries); err != nil {
		return nil, err
	}
	workspaceID, err := uuid.Parse(req.Msg.GetWorkspaceId())
	if err != nil {
		slog.Error("error parsing workspace id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	workspace, err := w.queries.GetWorkspace(ctx, workspaceID)
	if err != nil {
		slog.Error("error fetching workspace", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&v1.GetWorkspaceResponse{
		Workspace: workspaceProto(workspace),
	}), nil
}
