package vfs

import (
	"context"
	"errors"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"
)

func deleteInUseAssetsError(workspaceID uuid.UUID, usages []*v1.DeleteInUseAssetUsage) error {
	err := connect.NewError(
		connect.CodeFailedPrecondition,
		errors.New("cannot delete assets in use by projects"),
	)
	detail, detailErr := connect.NewErrorDetail(&v1.DeleteInUseAssetsError{
		WorkspaceId: workspaceID.String(),
		Usages:      usages,
	})
	if detailErr != nil {
		slog.Error("error creating delete in-use assets detail", "error", detailErr)
		return err
	}
	err.AddDetail(detail)
	return err
}

func (f *FileServiceServer) inUseAssetUsages(
	ctx context.Context,
	assets []db.Asset,
) ([]*v1.DeleteInUseAssetUsage, error) {
	var usages []*v1.DeleteInUseAssetUsage
	for _, asset := range assets {
		rows, err := f.queries.GetInUseAssetProjects(ctx, asset.ID)
		if err != nil {
			return nil, err
		}
		for _, row := range rows {
			usages = append(usages, &v1.DeleteInUseAssetUsage{
				AssetId:     row.AssetID.String(),
				AssetName:   row.AssetDisplayName,
				ProjectId:   row.ProjectID.String(),
				ProjectName: row.ProjectName,
			})
		}
	}
	return usages, nil
}
