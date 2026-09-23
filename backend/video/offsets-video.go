package video

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"os"
	"os/exec"
	"strconv"
)

type KeyFrame struct {
	ByteOffset uint64
	Size       uint64
}

// KeyFrameOffsets map a keyframe at timestamp X (ms) to byte offset Y of size S
// On working branching, bytes offsets are used for video playback to allow for
// granular cuts
// NOTE: never directly manipulate this type - only add through addKeyframe
type KeyFrameOffsets map[uint64]KeyFrame

const (
	keyFrameIntervalMs           uint64 = 500
	keyFrameTimestampToleranceMs uint64 = 100
)

func normalizeKeyFrameTimestamp(ts uint64) (uint64, error) {
	remainder := ts % keyFrameIntervalMs
	if remainder == 0 {
		return ts, nil
	}
	if remainder <= keyFrameTimestampToleranceMs {
		return ts - remainder, nil
	}
	if keyFrameIntervalMs-remainder <= keyFrameTimestampToleranceMs {
		return ts + keyFrameIntervalMs - remainder, nil
	}
	return 0, fmt.Errorf("key frame timestamp only valid near a 500ms boundary, got %d", ts)
}

func (o KeyFrameOffsets) addKeyframe(ts uint64, offset uint64, size uint64) error {
	normalizedTs, err := normalizeKeyFrameTimestamp(ts)
	if err != nil {
		return err
	}
	o[normalizedTs] = KeyFrame{offset, size}
	return nil
}

type ffprobeOutput struct {
	Frames []ffprobeFrame `json:"frames"`
}

// ffprobe JSON is inconsistent: key_frame is a bare int, but pkt_pos,
// pkt_size, and pts_time are emitted as quoted strings
type ffprobeFrame struct {
	KeyFrame int    `json:"key_frame"`
	PktPos   string `json:"pkt_pos"`
	PktSize  string `json:"pkt_size"`
	PtsTime  string `json:"pts_time"`
}

// GenerateOffsets will map a videos keyframe timestamps to the byte offset
// and GOP sizes for the keyframe - where GOP size is the byte difference between
// this keyframe and the next one (or the end of the video in the case of the final)
func GenerateOffsets(segPath string) (KeyFrameOffsets, error) {
	out, err := exec.Command("ffprobe",
		"-v", "error",
		"-select_streams", "v:0",
		"-show_frames",
		"-show_entries", "frame=key_frame,pkt_pos,pkt_size,pts_time",
		"-of", "json",
		segPath,
	).Output()
	if err != nil {
		return nil, fmt.Errorf("ffprobe error on %s: %w", segPath, err)
	}

	var probe ffprobeOutput
	if err := json.Unmarshal(out, &probe); err != nil {
		return nil, fmt.Errorf("failed to parse ffprobe output: %w", err)
	}

	offsets := make(KeyFrameOffsets)
	var currentTs uint64
	var currentOffset uint64
	// GOP (group of pictures) size tally: accumulates pkt_size of the current keyframe + all
	// its dependent P/B frames to give the total size of this segment
	// We flushed when the next keyframe arrives.
	var gopSize uint64
	hasKeyframe := false

	for _, frame := range probe.Frames {
		if frame.KeyFrame != 1 {
			continue
		}
		pktPos, err := strconv.ParseUint(frame.PktPos, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("failed to parse pkt_pos %q: %w", frame.PktPos, err)
		}
		// when we reach a keyframe, we check if we need to flush
		// our current keyframe that we were doing the size tally for
		if hasKeyframe {
			gopSize = pktPos - currentOffset
			if err := offsets.addKeyframe(currentTs, currentOffset, gopSize); err != nil {
				slog.Error("error adding keyframe segment", "error", err)
				return nil, err
			}
		}
		ptsSeconds, err := strconv.ParseFloat(frame.PtsTime, 64)
		if err != nil {
			return nil, fmt.Errorf("failed to parse pts_time %q: %w", frame.PtsTime, err)
		}
		currentTs = uint64(math.Round(ptsSeconds * 1000))
		currentOffset = pktPos
		hasKeyframe = true
	}

	// flush the last keyframe if there are any left
	if hasKeyframe {
		fi, err := os.Stat(segPath)
		if err != nil {
			return nil, fmt.Errorf("failed to stat segment %s: %w", segPath, err)
		}
		gopSize = uint64(fi.Size()) - currentOffset
		if err := offsets.addKeyframe(currentTs, currentOffset, gopSize); err != nil {
			slog.Error("error adding keyframe segment", "error", err)
			return nil, err
		}
	}

	return offsets, nil
}
