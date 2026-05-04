package vfs

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"
)

func (f *FileServiceServer) assertDirectoryMoveTarget(
	ctx context.Context,
	workspaceID uuid.UUID,
	directoryID uuid.UUID,
	parentID uuid.NullUUID,
) error {
	for parentID.Valid {
		if parentID.UUID == directoryID {
			return connect.NewError(connect.CodeInvalidArgument, nil)
		}
		parentDirectory, err := f.queries.GetDirectoryById(ctx, parentID.UUID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return connect.NewError(connect.CodeNotFound, err)
			}
			slog.Error("error fetching parent directory", "error", err)
			return connect.NewError(connect.CodeInternal, err)
		}
		if parentDirectory.WorkspaceID != workspaceID {
			return connect.NewError(connect.CodeNotFound, sql.ErrNoRows)
		}
		parentID = parentDirectory.ParentID
	}
	return nil
}
