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
	"strings"
)

const MIN_SEGMENT_LENGTH = 3

type VideoSegment struct {
	path            string
	durationString  string
	PercentComplete float64
}

// GenerateSegments splits the video stored at fp into .ts hls segements
// of length segLength. Minimum segment length is 3 seconds, and its recommended to
// stay around 3-6 seconds for your segments.
func GenerateSegments(
	fp string,
	videoID string,
	segLength int,
) (iter.Seq2[VideoSegment, error], error) {
	videoDuration, err := probeDuration(fp)
	if err != nil {
		slog.Error("could not dertermine video length")
		return nil, err
	}
	if segLength < MIN_SEGMENT_LENGTH {
		slog.Error(
			"segment length error",
			"segment size",
			segLength,
			"min segment size",
			MIN_SEGMENT_LENGTH,
		)
		return nil, errors.New("SEGMENT LENGTH ERROR")
	}
	segmentPath := fmt.Sprintf("segments/%s", videoID)
	manifestPath := fmt.Sprintf("%s/manifest.m3u8", segmentPath)
	os.MkdirAll(segmentPath, 0755)
	cmd := exec.Command("ffmpeg",
		"-loglevel", "info",
		"-i", fp,
		"-c:v", "libx264", // design decision: re-encode to force consistent key frames
		"-force_key_frames", fmt.Sprintf("expr:gte(t,n_forced*%d)", segLength),
		"-c:a", "aac",
		"-hls_time", strconv.Itoa(segLength),
		"-hls_list_size", "0",
		"-hls_playlist_type", "vod",
		"-hls_segment_filename", fmt.Sprintf("%s/seg_%%03d.ts", segmentPath),
		"-f", "hls",
		manifestPath,
	)
	reg := regexp.MustCompile(`segments/` + videoID + `/seg_\d+\.ts`)
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
							PercentComplete: (float64(count*segLength) / videoDuration) * 100,
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
			// yield last segment, with duration set to whatever is left prior
			if !yield(
				VideoSegment{
					path: prev,
					durationString: fmt.Sprintf(
						"%.6f",
						videoDuration-float64((count-1)*segLength),
					),
					PercentComplete: 100,
				},
				nil,
			) {
				return
			}
		}
	}, nil
}

// Gives exact video duration from ffprobe
func probeDuration(fp string) (float64, error) {
	out, err := exec.Command("ffprobe",
		"-v", "error",
		"-show_entries", "format=duration",
		"-of", "csv=p=0",
		fp,
	).Output()
	if err != nil {
		return 0, err
	}
	return strconv.ParseFloat(strings.TrimSpace(string(out)), 64)
}
