package video

import (
	"bufio"
	"errors"
	"fmt"
	"iter"
	"log/slog"
	"os"
	"os/exec"
	"regexp"
	"strconv"
)

func GenerateAudioSegments(
	fp string,
	audioID string,
	segLength int,
	audioDuration float64,
) (iter.Seq2[VideoSegment, error], string, error) {
	if segLength < MIN_SEGMENT_LENGTH {
		slog.Error(
			"segment length error",
			"segment size",
			segLength,
			"min segment size",
			MIN_SEGMENT_LENGTH,
		)
		return nil, "", errors.New("SEGMENT LENGTH ERROR")
	}
	tmpDir, err := os.MkdirTemp("", "vynfo-audio-seg-"+audioID+"-*")
	if err != nil {
		return nil, "", err
	}
	cmd := exec.Command("ffmpeg",
		"-loglevel", "info",
		"-i", fp,
		"-vn",
		"-c:a", "aac",
		"-muxdelay", "0",
		"-muxpreload", "0",
		"-f", "segment",
		"-segment_time", strconv.Itoa(segLength),
		"-segment_format", "mpegts",
		"-reset_timestamps", "0",
		fmt.Sprintf("%s/seg_%%03d.ts", tmpDir),
	)
	reg := regexp.MustCompile(regexp.QuoteMeta(tmpDir) + `/seg_\d+\.ts`)
	count := 0

	return func(yield func(VideoSegment, error) bool) {
		stderr, err := cmd.StderrPipe()
		if err != nil {
			yield(VideoSegment{}, err)
			return
		}
		if err := cmd.Start(); err != nil {
			yield(VideoSegment{}, err)
			return
		}

		scanner := bufio.NewScanner(stderr)
		var prev string
		for scanner.Scan() {
			match := reg.FindString(scanner.Text())
			if match != "" {
				count++
				if prev != "" {
					if !yield(
						VideoSegment{
							path:            prev,
							durationString:  fmt.Sprintf("%.6f", float64(segLength)),
							PercentComplete: (float64(count*segLength) / audioDuration) * 100,
						},
						nil,
					) {
						return
					}
				}
				prev = match
			}
			slog.Debug("ffmpeg", "output", scanner.Text())
		}
		if err := cmd.Wait(); err != nil {
			yield(VideoSegment{}, err)
			return
		}
		if prev != "" {
			if !yield(
				VideoSegment{
					path: prev,
					durationString: fmt.Sprintf(
						"%.6f",
						audioDuration-float64((count-1)*segLength),
					),
					PercentComplete: 100,
				},
				nil,
			) {
				return
			}
		}
	}, tmpDir, nil
}
