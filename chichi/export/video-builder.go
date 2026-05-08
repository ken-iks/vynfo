package export

import (
	"fmt"
	"os/exec"
)

type VideoExportBuilder struct {
	// ffmpeg filter graphs will always begin with a set of input from
	// the original assets whos urls we sign. We also have a cache that 
	// maps video ids to their index in the inputs array for fast lookup
	assetIdIndexLookup map[string]int 
	inputsUrls []string
	// each line in the filter graph is assigned to a variable and
	// these variables can then be used as input to downstream expressions
	// that follow.
	lineOutputVariables []FilterGraphLineOutput
	filterGraph []FilterGraphLine

	segmentSegmentOutputVariables []string

	output *FilterGraphFinalOutput
}

// adds the output line to the builder, ready to be build
func (v *VideoExportBuilder) AddFinalOutput(
	videoStreamVariable string, 
	audioStreamVariable string, 
	outputFp string) error {
	if v.output != nil {
		return fmt.Errorf("cannot add another final output, build ended", "final", v.output)
	}
	v.output = &FilterGraphFinalOutput{
		videoStreamVariable: videoStreamVariable,
		audioStreamVariable: audioStreamVariable,
		outputFp: outputFp,
	}
	return nil
}

func (v *VideoExportBuilder) ComposeCommand() *exec.Cmd {

}