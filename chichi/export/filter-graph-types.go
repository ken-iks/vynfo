package export

import "fmt"

type FilterGraphExpressionKind int

const (
	Cut FilterGraphExpressionKind = iota
	BackgroundAudio
	Concat
)

func (k FilterGraphExpressionKind) String() string {
	switch k {
	case Cut:
		return "Cut"
	case BackgroundAudio:
		return "BackgroundAudio"
	case Concat:
		return "Concat"
	default:
		return fmt.Sprintf("FilterGraphExpressionKind(%d)", int(k))
	}
}

type InputStreamType int

const (
	AudioOnly InputStreamType = iota
	VideoOnly
	VideoWithAudio
)

type FilterGraphClauseKind int

const (
	AudioDelay FilterGraphClauseKind = iota
	Grayscale
)

func (k FilterGraphClauseKind) String() string {
	switch k {
	case AudioDelay:
		return "AudioDelay"
	case Grayscale:
		return "Grayscale"
	default:
		return fmt.Sprintf("FilterGraphClauseKind(%d)", int(k))
	}
}

type FilterGraphCutExpression struct {
	inputIndex       int
	streamType       InputStreamType
	startTimeSeconds float64
	endTimeSeconds   float64
}

// Concat expressions take an ordered list of variables to concatenate into
// stream(s). If VideoWithAudio type is selected, the list is expected to be
// an alternating list of video and audio variables
type FilterGraphConcatExpression struct {
	variableIdxs []int
	streamType   InputStreamType
}

// Used when a background audio starts at some offset into the
// video its playing in the background of
type FilterGraphAudioDelayClause struct {
	offsetIntoVideoSeconds float64
}

// For the background audio expression, there will always be at
// least one original video audio since there will be a video as
// part of a commit. With multiple videos, the 'original' audio
// stream will be the output of the concat of all of the video
// audio streams
type FilterGraphBackgroundAudioExpression struct {
	originalAudioVariableIndex int
	audioOverlayVariableIndex  int
}

type FilterGraphGrayscaleClause struct{}

type FilterGraphExpression struct {
	kind   FilterGraphExpressionKind
	cut    FilterGraphCutExpression
	audio  FilterGraphBackgroundAudioExpression
	concat FilterGraphConcatExpression
}

// Filter graph clauses are separated with a , delimeter, and must
// follow an expression (separated from the expression with a comma)
type FilterGraphClause struct {
	kind      FilterGraphClauseKind
	inputKind InputStreamType
	delay     FilterGraphAudioDelayClause
	grayscale FilterGraphGrayscaleClause
}

// Filter graph lines are separated with a ; delimeter
// NOTE: clauses must match the stream type of the line they are acting on.
type FilterGraphLine struct {
	expression FilterGraphExpression
	clauses    []FilterGraphClause
}

// Filter graph segments are logical segments within the feature graph
// aligned with a given vynfo playback segment
// these are what get concated at the end
type FilterGraphSegment struct {
	lines               []FilterGraphLine
	videoStreamVariable string
	audioStreamVariable string
}

type FilterGraphFinalOutput struct {
	videoStreamVariable string
	audioStreamVariable string
	outputFp            string
}

type FilterGraphLineOutput struct {
	videos []string
	audios []string
}
