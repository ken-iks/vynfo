package project

import (
	"context"
	"log/slog"

	"connectrpc.com/connect"
	"github.com/google/uuid"

	v1 "vynfo.com/vynfo/gen/proto/v1"
)

func (p *ProjectServiceServer) ListProjectAssets(
	ctx context.Context,
	req *connect.Request[v1.ListProjectAssetsRequest],
) (*connect.Response[v1.ListProjectAssetsResponse], error) {
	projectID, err := uuid.Parse(req.Msg.GetProjectId())
	if err != nil {
		slog.Error("error parsing project id")
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	assets, err := p.queries.GetProjectAssets(ctx, projectID)
	if err != nil {
		slog.Error("error fetching project assets", "error", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	var videos []*v1.MediaVideoMetadata
	var images []*v1.MediaImageMetadata
	var textBoxes []*v1.MediaTextMetadata

	for _, a := range assets {
		switch a.AssetType {
		case "video":
			vid, err := p.queries.GetVideoById(ctx, a.ID)
			if err != nil {
				slog.Error("error fetching video metadata", "asset_id", a.ID, "error", err)
				return nil, connect.NewError(connect.CodeInternal, err)
			}
			videos = append(videos, &v1.MediaVideoMetadata{
				AssetId:  vid.AssetID.String(),
				Title:    vid.DisplayName,
				Duration: vid.Duration,
			})
		case "photo":
			images = append(images, &v1.MediaImageMetadata{
				AssetId: a.ID.String(),
			})
		case "text":
			textBoxes = append(textBoxes, &v1.MediaTextMetadata{
				AssetId: a.ID.String(),
			})
		}
	}

	return connect.NewResponse(&v1.ListProjectAssetsResponse{
		Videos:    videos,
		Images:    images,
		TextBoxes: textBoxes,
	}), nil
}
