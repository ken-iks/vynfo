package video

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	v1 "vynfo.com/vynfo/gen/proto/v1"
	"vynfo.com/vynfo/internal/db"
)

const KEYFRAMES_PER_SECOND = 2

func segmentPathFromKeyframe(videoID string, segIdx int64) string {
	return fmt.Sprintf("segments/%s/seg_%03d.ts", videoID, segIdx)
}

func serializeSection(
	ctx context.Context,
	queries *db.Queries,
	section *v1.PlaybackSection,
	isFirst bool,
) (string, error) {
	v := section.GetVideo()
	videoID := v.GetMeta().AssetId
	videoStartMs := v.GetVideoStartTimeMillies()
	durationMs := section.GetEndTimeMillis() - section.GetStartTimeMillis()
	limit := int32(durationMs * KEYFRAMES_PER_SECOND / 1000)
	if limit == 0 {
		limit = 1
	}

	parsed, err := uuid.Parse(videoID)
	if err != nil {
		return "", fmt.Errorf("invalid video id %q: %w", videoID, err)
	}

	keyframes, err := queries.GetKeyFrameRange(ctx, db.GetKeyFrameRangeParams{
		VideoID:          parsed,
		TimestampInVideo: int64(videoStartMs),
		Limit:            limit,
	})
	if err != nil {
		return "", fmt.Errorf("failed to query keyframes for video %s: %w", videoID, err)
	}
	if len(keyframes) == 0 {
		return "", fmt.Errorf(
			"no keyframes found for video %s at timestamp %d",
			videoID,
			videoStartMs,
		)
	}

	var b strings.Builder
	if !isFirst {
		b.WriteString("\n#EXT-X-DISCONTINUITY")
	}

	prevSegIdx := int64(-1)
	for i, kf := range keyframes {
		var segDuration float64
		if i+1 < len(keyframes) {
			segDuration = float64(keyframes[i+1].TimestampInVideo-kf.TimestampInVideo) / 1000.0
		} else {
			segDuration = 0.5
		}
		if kf.SegmentIdx != prevSegIdx && prevSegIdx != -1 {
			b.WriteString("\n#EXT-X-DISCONTINUITY")
		}
		segPath := segmentPathFromKeyframe(videoID, kf.SegmentIdx)
		b.WriteString(fmt.Sprintf("\n#EXTINF:%.6f,", segDuration))
		b.WriteString(
			fmt.Sprintf("\n#EXT-X-BYTERANGE:%d@%d", kf.SizeInBytes, kf.ByteOffsetInSegment),
		)
		b.WriteString(fmt.Sprintf("\n%s", segPath))
		prevSegIdx = kf.SegmentIdx
	}

	return b.String(), nil
}

func ParsePlaybackStateToHLS(
	ctx context.Context,
	queries *db.Queries,
	state []*v1.PlaybackSection,
) (string, error) {
	base := MANIFEST_PERSISTED_BASE
	for i, section := range state {
		seg, err := serializeSection(ctx, queries, section, i == 0)
		if err != nil {
			return "", err
		}
		base += seg
	}
	base += "\n#EXT-X-ENDLIST"
	return base, nil
}
