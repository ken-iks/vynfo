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
// stay around 3-6 seconds for your segments. We also choose to re encode the video
// with a keyframe interval of 0.5 seconds to allow editing at this granularity. Keyframe
// interval should always cleanly divide into segLength in order to get consistent segment
// lengths (segments have to start at keyframes).
func GenerateSegments(
	fp string,
	videoID string,
	segLength int,
	videoDuration float64,
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
	tmpDir, err := os.MkdirTemp("", "vynfo-seg-"+videoID+"-*")
	if err != nil {
		return nil, "", err
	}
	// Re-encode with consistent keyframes for sub-second editing granularity.
	// -r 30: CFR at 30fps so frames land exactly on 500ms boundaries (frame 15 = 500ms).
	//        VFR sources drift and keyframe PTS won't be divisible by 500ms without this.
	// -force_key_frames: IDR frame every 0.5s — must cleanly divide into segLength.
	// -x264-params scenecut=-1: disable scene-cut detection so the ONLY keyframes are the
	//        forced ones. Without this x264 injects extras at arbitrary timestamps.
	cmd := exec.Command("ffmpeg",
		"-loglevel", "info",
		"-i", fp,
		"-c:v", "libx264",
		"-preset", "ultrafast",
		"-tune", "zerolatency",
		"-r", "30",
		"-force_key_frames", fmt.Sprintf("expr:gte(t,n_forced*%.1f)", 0.5),
		"-x264-params", "scenecut=-1",
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
	}, tmpDir, nil
}

// Gives exact video duration from ffprobe
func ProbeDuration(fp string) (float64, error) {
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
