package exporter

import (
	"fmt"
	"os/exec"
	"strconv"
	"strings"
)

func (v *VideoExportBuilder) BuildExportCommand() (*exec.Cmd, error) {
	if !v.ready {
		return nil, fmt.Errorf("builder not ready")
	}

	// Start with all signed asset URLs as ffmpeg inputs.
	args := []string{"-y"}
	for _, inputURL := range v.inputsUrls {
		args = append(args, "-i", inputURL)
	}

	var filterGraph strings.Builder
	for cutIdx, cut := range v.cuts {
		// Trim each video stream into a cut, reset its timestamps, and chain any effects.
		fmt.Fprintf(
			&filterGraph,
			"[%d:v]trim=start=%s:end=%s,setpts=PTS-STARTPTS",
			cut.inputIndex,
			formatFloat(cut.startTimeSeconds),
			formatFloat(cut.endTimeSeconds),
		)
		for _, effect := range cut.effects {
			filterGraph.WriteString(effect.AsClause())
		}
		fmt.Fprintf(&filterGraph, "[v%d];", cutIdx)

		// Make the equivalent audio cut for the same video stream.
		// When audio is excluded, keep the stream shape but mute it before concat.
		if !cut.includeAudio {
			fmt.Fprintf(
				&filterGraph,
				"anullsrc=channel_layout=stereo:sample_rate=48000,atrim=duration=%s,asetpts=PTS-STARTPTS[a%d];",
				formatFloat(cut.endTimeSeconds-cut.startTimeSeconds),
				cutIdx,
			)
			continue
		}
		fmt.Fprintf(
			&filterGraph,
			"[%d:a]atrim=start=%s:end=%s,asetpts=PTS-STARTPTS,volume=1[a%d];",
			cut.inputIndex,
			formatFloat(cut.startTimeSeconds),
			formatFloat(cut.endTimeSeconds),
			cutIdx,
		)
	}

	// Concat all video cuts and their matching audio cuts into the main export streams.
	for cutIdx := range v.cuts {
		fmt.Fprintf(&filterGraph, "[v%d][a%d]", cutIdx, cutIdx)
	}
	fmt.Fprintf(&filterGraph, "concat=n=%d:v=1:a=1[video][videoaudio]", len(v.cuts))

	audioLabel := "videoaudio"
	if len(v.audios) > 0 {
		filterGraph.WriteString(";")
		for audioIdx, audio := range v.audios {
			// Trim each background audio, set its volume, and delay it to its video offset.
			fmt.Fprintf(
				&filterGraph,
				"[%d:a]atrim=start=%s:end=%s,asetpts=PTS-STARTPTS,volume=%s,adelay=%s|%s[backgroundaudio%d];",
				audio.inputIndex,
				formatFloat(audio.startTimeSeconds),
				formatFloat(audio.endTimeSeconds),
				formatFloat(audio.volume),
				strconv.FormatUint(audio.offsetIntoVideoSeconds, 10),
				strconv.FormatUint(audio.offsetIntoVideoSeconds, 10),
				audioIdx,
			)
		}

		// Mix background audio into the concated video audio, using the video audio duration.
		filterGraph.WriteString("[videoaudio]")
		for audioIdx := range v.audios {
			fmt.Fprintf(&filterGraph, "[backgroundaudio%d]", audioIdx)
		}
		filterGraph.WriteString("amix=inputs=")
		filterGraph.WriteString(strconv.Itoa(len(v.audios) + 1))
		filterGraph.WriteString(":duration=first[audio]")
		audioLabel = "audio"
	}

	// Map the final video stream and whichever audio stream was last produced.
	args = append(
		args,
		"-filter_complex",
		filterGraph.String(),
		"-map",
		"[video]",
		"-map",
		"["+audioLabel+"]",
		"-c:v",
		"libx264",
		"-pix_fmt",
		"yuv420p",
		"-c:a",
		"aac",
		"-movflags",
		"+faststart",
		v.outputFp,
	)

	return exec.Command("ffmpeg", args...), nil
}

func formatFloat(value float64) string {
	return strconv.FormatFloat(value, 'f', -1, 64)
}
