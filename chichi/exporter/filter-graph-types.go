package exporter

type FilterGraphVideoCut struct {
	inputIndex       int
	startTimeSeconds float64
	endTimeSeconds   float64
	includeAudio     bool
	effects          []FilterGraphEffect
}

type FilterGraphAudioCut struct {
	inputIndex             int
	startTimeSeconds       float64
	endTimeSeconds         float64
	offsetIntoVideoSeconds uint64
	volume                 float64
}

