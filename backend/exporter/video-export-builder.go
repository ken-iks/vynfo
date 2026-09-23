package exporter

import (
	"fmt"
)

type VideoExportBuilder struct {
	// ffmpeg filter graphs will always begin with a set of input from
	// the original assets whos urls we sign. We also have a cache that
	// maps video ids to their index in the inputs array for fast lookup
	assetIdIndexLookup map[string]int
	inputsUrls         []string

	// the cuts and audios make up the full video that will be exported
	cuts   []FilterGraphVideoCut
	audios []FilterGraphAudioCut

	// the file path that the exported mp4 file will go to
	outputFp string

	// ready is set when the builder is ready to be built
	ready bool
}

func Init() VideoExportBuilder {
	return VideoExportBuilder{
		assetIdIndexLookup: make(map[string]int),
		inputsUrls:         []string{},
		ready:              false,
	}
}

func (v *VideoExportBuilder) AssertReady() (*VideoExportBuilder, error) {
	if !v.ready {
		return nil, fmt.Errorf("builder not ready")
	}
	return v, nil
}

func (v *VideoExportBuilder) AddBackgroundAudio(
	assetId string,
	startSecs float64,
	endSecs float64,
	offsetIntoVideoMillis uint64, volume float64) error {
	if len(v.cuts) < 1 {
		return fmt.Errorf("first add video cuts before adding background audio")
	}
	if v.ready {
		return fmt.Errorf("cannot add background audios after builder is ready to be built")
	}
	inputidx, ok := v.assetIdIndexLookup[assetId]
	if !ok {
		return fmt.Errorf("could not locate asset with id %s", assetId)
	}
	v.audios = append(v.audios, FilterGraphAudioCut{
		inputIndex:             inputidx,
		startTimeSeconds:       startSecs,
		endTimeSeconds:         endSecs,
		offsetIntoVideoSeconds: offsetIntoVideoMillis,
		volume:                 volume,
	})
	return nil
}

func (v *VideoExportBuilder) AppendVideoCut(
	assetId string,
	startSecs float64,
	endSecs float64, includeAudio bool, effects []FilterGraphEffect) error {
	if len(v.inputsUrls) < 1 {
		return fmt.Errorf("first add inputs before adding video cuts")
	}
	if v.ready {
		return fmt.Errorf("cannot add video cuts after builder is ready to be built")
	}
	inputidx, ok := v.assetIdIndexLookup[assetId]
	if !ok {
		return fmt.Errorf("could not locate asset with id %s", assetId)
	}
	v.cuts = append(v.cuts, FilterGraphVideoCut{
		inputIndex:       inputidx,
		startTimeSeconds: startSecs,
		endTimeSeconds:   endSecs,
		includeAudio:     includeAudio,
		effects:          effects,
	})
	return nil
}

func (v *VideoExportBuilder) SetInputs(inputUrls []string, lookupMap map[string]int) error {
	if len(inputUrls) > len(lookupMap) {
		return fmt.Errorf("cannot have more urls than the lookup map length")
	}
	if v.ready {
		return fmt.Errorf("cannot reset inputs after builder is ready to be built")
	}
	v.inputsUrls = inputUrls
	v.assetIdIndexLookup = lookupMap

	return nil
}

func (v *VideoExportBuilder) SetOutputPath(outputFp string) error {
	if len(v.cuts) < 1 {
		return fmt.Errorf("first add cuts before setting the output path")
	}
	if v.ready {
		return fmt.Errorf("cannot reset outputs after builder is ready to be built")
	}
	v.outputFp = outputFp
	v.ready = true
	return nil
}
