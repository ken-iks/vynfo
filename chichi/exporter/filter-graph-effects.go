package exporter

import "strconv"

type FilterGraphEffect interface {
	AsClause() string
}

type FilterGraphSepia struct{}

func (FilterGraphSepia) AsClause() string {
	return ",colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131"
}

type FilterGraphSaturation struct {
	Strength float64
}

func (f FilterGraphSaturation) AsClause() string {
	return ",eq=saturation=" + strconv.FormatFloat(f.Strength, 'f', -1, 64)
}

type FilterGraphBrightness struct {
	Strength float64
}

func (f FilterGraphBrightness) AsClause() string {
	return ",eq=brightness=" + strconv.FormatFloat(f.Strength, 'f', -1, 64)
}

type FilterGraphBlur struct {
	Strength float64
}

func (f FilterGraphBlur) AsClause() string {
	return ",gblur=sigma=" + strconv.FormatFloat(f.Strength, 'f', -1, 64)
}
