package video

import (
	"fmt"
	"time"

	"cloud.google.com/go/storage"
	"vynfo.com/vynfo/exporter"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/shared"
)

func PrepareExporter(
	state *v1.PlaybackState,
	client *storage.Client,
	outputFp string,
) (*exporter.VideoExportBuilder, error) {
	builder := exporter.Init()

	// step 1: add inputs to the builder
	seen := make(map[string]bool)

	urls := []string{}
	assetLookupIdx := make(map[string]int)

	for _, video := range state.VideoSections {
		id := video.Video.Meta.AssetId
		if !seen[id] {
			url, err := signAsset(id, client, "video")
			if err != nil {
				return nil, err
			}
			urls = append(urls, url)
			assetLookupIdx[id] = len(urls) - 1
			seen[id] = true
		}
	}
	for _, audio := range state.AudioSections {
		id := audio.Audio.Meta.AssetId
		if !seen[id] {
			url, err := signAsset(id, client, "audio")
			if err != nil {
				return nil, err
			}
			urls = append(urls, url)
			assetLookupIdx[id] = len(urls) - 1
			seen[id] = true
		}
	}

	if err := builder.SetInputs(urls, assetLookupIdx); err != nil {
		return nil, err
	}

	// step 2: add video cuts
	for _, video := range state.VideoSections {
		effects, err := resolveEffects(video.Video.Effects)
		if err != nil {
			return nil, err
		}
		startTimeInVideoMillis := video.Video.VideoStartTimeMillies
		endTimeInVideoMillis := startTimeInVideoMillis + (video.EndTimeMillis - video.StartTimeMillis)
		err = builder.AppendVideoCut(
			video.Video.Meta.AssetId,
			float64(startTimeInVideoMillis)/1000,
			float64(endTimeInVideoMillis)/1000,
			video.Video.Meta.HasAudio,
			effects,
		)
		if err != nil {
			return nil, err
		}
	}

	// step 3: add background audio
	for _, audio := range state.AudioSections {
		endTimeInAudioMillis := (audio.EndTimeMillis - audio.StartTimeMillis) + audio.Audio.AudioStartTimeMillies
		err := builder.AddBackgroundAudio(
			audio.Audio.Meta.AssetId,
			float64(audio.Audio.AudioStartTimeMillies)/1000,
			float64(endTimeInAudioMillis)/1000,
			audio.StartTimeMillis,
			1,
		)
		if err != nil {
			return nil, err
		}
	}

	// step 4: give builder a filepath
	builder.SetOutputPath(outputFp)

	// step 5: return the ready exporter
	return builder.AssertReady()
}

func signAsset(assetId string, client *storage.Client, assetType string) (string, error) {
	path, err := shared.GetUploadPath(assetId, assetType)
	if err != nil {
		return "", fmt.Errorf("")
	}
	url, err := client.Bucket("vedit-v1").SignedURL(path, &storage.SignedURLOptions{
		Method:  "GET",
		Expires: time.Now().Add(15 * time.Minute),
	})
	if err != nil {
		return "", fmt.Errorf("")
	}
	return url, nil
}

func resolveEffects(effects []*v1.MediaVideoEffect) ([]exporter.FilterGraphEffect, error) {
	exporters := []exporter.FilterGraphEffect{}
	for _, effect := range effects {
		switch effectKind := effect.Effect.(type) {
		case *v1.MediaVideoEffect_Blur:
			exporters = append(exporters, exporter.FilterGraphBlur{Strength: effectKind.Blur.Intensity})
		case *v1.MediaVideoEffect_Sepia:
			exporters = append(exporters, exporter.FilterGraphSepia{})
		case *v1.MediaVideoEffect_Saturation:
			exporters = append(exporters, exporter.FilterGraphSaturation{Strength: effectKind.Saturation.Strength})
		case *v1.MediaVideoEffect_Brightness:
			exporters = append(exporters, exporter.FilterGraphBrightness{Strength: effectKind.Brightness.Strength})
		default:
			return nil, fmt.Errorf("unknown effect")
		}
	}
	return exporters, nil
}
