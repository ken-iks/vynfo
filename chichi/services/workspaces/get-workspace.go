package workspaces

import (
	"context"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"
)

func (w *WorkspacesServiceServer) GetWorkspace(
	ctx context.Context,
	req *connect.Request[v1.GetWorkspaceRequest],
) (*connect.Response[v1.GetWorkspaceResponse], error) {
	user, err := auth.RequireOnboardedUser(ctx, w.queries)
	if err != nil {
		return nil, err
	}
	workspaceID, err := uuid.Parse(req.Msg.GetWorkspaceId())
	if err != nil {
		slog.Error("error parsing workspace id", "error", err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	isMember, err := w.queries.IsWorkspaceMember(ctx, db.IsWorkspaceMemberParams{
		WorkspaceID: workspaceID,
		MemberID:    user.ID,
	})
	if err != nil {
		slog.Error("error checking workspace membership", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if !isMember {
		return nil, connect.NewError(connect.CodePermissionDenied, nil)
	}

	rows, err := w.queries.GetWorkspaceWithMembers(ctx, workspaceID)
	if err != nil {
		slog.Error("error fetching workspace", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if len(rows) == 0 {
		return nil, connect.NewError(connect.CodeNotFound, nil)
	}

	workspace := workspaceProto(rows[0])
	for _, row := range rows {
		if row.MemberID.Valid {
			appendWorkspaceUser(
				workspace,
				row.MemberID.UUID.String(),
				row.MemberEmail.String,
				row.MemberDisplayName.String,
			)
		}
	}

	return connect.NewResponse(&v1.GetWorkspaceResponse{
		Workspace: workspace,
	}), nil
}
