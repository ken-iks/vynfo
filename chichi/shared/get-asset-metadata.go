package shared

import (
	"context"
	"log/slog"
	"time"

	"cloud.google.com/go/storage"
	"connectrpc.com/connect"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"
)

type AssetMetadataResponse struct {
	Videos []*v1.MediaVideoMetadata
	Images []*v1.MediaImageMetadata
	Audios []*v1.MediaAudioMetadata
}

func GetAssetMetadata(
	ctx context.Context,
	storageClient *storage.Client,
	queries *db.Queries,
	assets []db.Asset,
) (*AssetMetadataResponse, error) {
	var videos []*v1.MediaVideoMetadata
	var images []*v1.MediaImageMetadata
	var audios []*v1.MediaAudioMetadata

	for _, a := range assets {
		switch a.AssetType {
		case "video":
			vid, err := queries.GetVideoById(ctx, a.ID)
			if err != nil {
				slog.Error("error fetching video metadata", "asset_id", a.ID, "error", err)
				return nil, connect.NewError(connect.CodeInternal, err)
			}
			videos = append(videos, &v1.MediaVideoMetadata{
				AssetId:  vid.AssetID.String(),
				Title:    a.DisplayName,
				Duration: vid.Duration,
			})
		case "photo":
			img, err := queries.GetImageById(ctx, a.ID)
			if err != nil {
				slog.Error("error fetching image metadata", "asset_id", a.ID, "error", err)
				return nil, connect.NewError(connect.CodeInternal, err)
			}
			signedURL, err := storageClient.Bucket("vedit-v1").SignedURL(
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
				Title:       a.DisplayName,
				ContentType: img.ContentType,
			})
		case "audio":
			audio, err := queries.GetAudioById(ctx, a.ID)
			if err != nil {
				slog.Error("error fetching audio metadata", "asset_id", a.ID, "error", err)
				return nil, connect.NewError(connect.CodeInternal, err)
			}
			audios = append(audios, &v1.MediaAudioMetadata{
				AssetId:  audio.AssetID.String(),
				Title:    a.DisplayName,
				Duration: audio.Duration,
			})
		}
	}
	return &AssetMetadataResponse{
		Videos: videos,
		Audios: audios,
		Images: images,
	}, nil
}
