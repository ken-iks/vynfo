package project

import (
	"context"
	"log/slog"
	"time"

	"cloud.google.com/go/storage"
	"connectrpc.com/connect"
	"github.com/google/uuid"

	"vynfo.com/vynfo/auth"
	v1 "vynfo.com/vynfo/gen/proto/v1"
)

func (p *ProjectServiceServer) ListProjectAssets(
	ctx context.Context,
	req *connect.Request[v1.ListProjectAssetsRequest],
) (*connect.Response[v1.ListProjectAssetsResponse], error) {
	if _, err := auth.RequireOnboardedUser(ctx, p.queries); err != nil {
		return nil, err
	}

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
	var audios []*v1.MediaAudioMetadata

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
			img, err := p.queries.GetImageById(ctx, a.ID)
			if err != nil {
				slog.Error("error fetching image metadata", "asset_id", a.ID, "error", err)
				return nil, connect.NewError(connect.CodeInternal, err)
			}
			signedURL, err := p.storageClient.Bucket("vedit-v1").SignedURL(
				img.ObjectPath,
				&storage.SignedURLOptions{
					Method:  "GET",
					Expires: time.Now().Add(15 * time.Minute),
				},
			)
			if err != nil {
				slog.Error("error signing image url", "asset_id", a.ID, "error", err)
				return nil, connect.NewError(connect.CodeInternal, err)
			}
			images = append(images, &v1.MediaImageMetadata{
				AssetId:     a.ID.String(),
				SignedUrl:   signedURL,
				Title:       img.DisplayName,
				ContentType: img.ContentType,
			})
		case "text":
			text, err := p.queries.GetTextById(ctx, a.ID)
			if err != nil {
				slog.Error("error fetching text metadata", "asset_id", a.ID, "error", err)
				return nil, connect.NewError(connect.CodeInternal, err)
			}
			textBoxes = append(textBoxes, &v1.MediaTextMetadata{
				AssetId: a.ID.String(),
				Content: text.Content,
				Title:   text.DisplayName,
			})
		case "audio":
			audio, err := p.queries.GetAudioById(ctx, a.ID)
			if err != nil {
				slog.Error("error fetching audio metadata", "asset_id", a.ID, "error", err)
				return nil, connect.NewError(connect.CodeInternal, err)
			}
			audios = append(audios, &v1.MediaAudioMetadata{
				AssetId:  audio.AssetID.String(),
				Title:    audio.DisplayName,
				Duration: audio.Duration,
			})
		}
	}

	return connect.NewResponse(&v1.ListProjectAssetsResponse{
		Videos:    videos,
		Images:    images,
		TextBoxes: textBoxes,
		Audios:    audios,
	}), nil
}
