package video

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"strconv"
)

const AUDIO_FRAME_WINDOW_MS = 500

type AudioFrame struct {
	ByteOffset int64
	Size       int64
}

type AudioFrameOffsets map[int64]AudioFrame

func (o AudioFrameOffsets) addAudioFrame(ts int64, offset int64, size int64) error {
	if ts%AUDIO_FRAME_WINDOW_MS != 0 {
		return fmt.Errorf("audio frame timestamp only valid when divisible by 500ms, got %d", ts)
	}
	o[ts] = AudioFrame{offset, size}
	return nil
}

type ffprobePacketOutput struct {
	Packets []ffprobePacket `json:"packets"`
}

type ffprobePacket struct {
	PtsTime string `json:"pts_time"`
	Pos     string `json:"pos"`
}

func GenerateAudioOffsets(segPath string) (AudioFrameOffsets, error) {
	out, err := exec.Command("ffprobe",
		"-v", "error",
		"-select_streams", "a:0",
		"-show_packets",
		"-show_entries", "packet=pts_time,pos",
		"-of", "json",
		segPath,
	).Output()
	if err != nil {
		return nil, fmt.Errorf("ffprobe error on %s: %w", segPath, err)
	}

	var probe ffprobePacketOutput
	if err := json.Unmarshal(out, &probe); err != nil {
		return nil, fmt.Errorf("failed to parse ffprobe output: %w", err)
	}

	offsets := make(AudioFrameOffsets)
	var currentTs int64
	var currentOffset int64
	hasFrame := false

	for _, packet := range probe.Packets {
		pktPos, err := strconv.ParseInt(packet.Pos, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("failed to parse packet pos %q: %w", packet.Pos, err)
		}
		ptsSeconds, err := strconv.ParseFloat(packet.PtsTime, 64)
		if err != nil {
			return nil, fmt.Errorf("failed to parse pts_time %q: %w", packet.PtsTime, err)
		}
		ptsMs := int64(ptsSeconds*1000 + 0.5)
		bucketTs := (ptsMs / AUDIO_FRAME_WINDOW_MS) * AUDIO_FRAME_WINDOW_MS
		if !hasFrame {
			currentTs = bucketTs
			currentOffset = pktPos
			hasFrame = true
			continue
		}
		if bucketTs == currentTs {
			continue
		}
		// Byte-range size is measured to the next bucket's first packet so TS
		// container bytes stay included in the playable range.
		if err := offsets.addAudioFrame(currentTs, currentOffset, pktPos-currentOffset); err != nil {
			slog.Error("error adding audio frame segment", "error", err)
			return nil, err
		}
		currentTs = bucketTs
		currentOffset = pktPos
	}

	if hasFrame {
		fi, err := os.Stat(segPath)
		if err != nil {
			return nil, fmt.Errorf("failed to stat segment %s: %w", segPath, err)
		}
		if err := offsets.addAudioFrame(currentTs, currentOffset, fi.Size()-currentOffset); err != nil {
			slog.Error("error adding audio frame segment", "error", err)
			return nil, err
		}
	}

	return offsets, nil
}
