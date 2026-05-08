package export

import (
	"fmt"
	"strings"
)

// this parses a filter graph expression object into its ffmpeg command
// string parts that can be directly inserted within a cmd.Exec
func parseFilterGraphLine(line FilterGraphLine) (string, error) {
	expr := line.expression
	switch expr.kind {
	case Cut:
		return parseCutExpression(expr.cut, line.clauses)
	case BackgroundAudio:
		return parseBackGroundAudioExpression(expr.audio)
	case Concat:
		return parseConcatExpression(expr.concat)
	default:
		return "", fmt.Errorf("unrecognized expression type %s", expr.kind.String())
	}
}

func parseFilterGraphClauses(expressionStreamType InputStreamType, clauses []FilterGraphClause) (string, error) {
	var final strings.Builder
	for _, c := range clauses {
		if expressionStreamType != c.inputKind {
			return "", fmt.Errorf("filter graph clauses must match expression stream type")
		}
		switch c.kind {
		case AudioDelay:
			final.WriteString(fmt.Sprintf(",adelay=%f:all=1", c.delay.offsetIntoVideoSeconds))
		case Grayscale:
			final.WriteString(",format=gray")
		default:
			return "", fmt.Errorf("unrecognized clause type %s", c.kind.String())
		}
	}
	return final.String(), nil
}

func parseCutExpression(expr FilterGraphCutExpression, clauses []FilterGraphClause) (string, error) {
	input := fmt.Sprintf("[%d:%v]")
}
