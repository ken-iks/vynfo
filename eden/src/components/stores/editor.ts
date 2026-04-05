import type { MediaOverlay, MediaVideoMetadata, PlaybackSection } from "@/gen/proto/v1/api_pb";
import { PlaybackSectionSchema } from "@/gen/proto/v1/api_pb";
import { create } from "@bufbuild/protobuf";
import { proxy } from "valtio";

class EditorStore {
    sections: PlaybackSection[] = []
    selectedSectionIndex: number | null = null

    get totalDurationMillis(): bigint {
        return this.sections.reduce(
            (sum, s) => sum + (s.endTimeMillis - s.startTimeMillis),
            0n,
        )
    }

    selectSection(index: number | null) {
        this.selectedSectionIndex = index
    }

    addSection(section: PlaybackSection, insertAtIndex?: number) {
        if (!insertAtIndex) {
            this.sections.push(section);
        } else {
            this.sections.splice(insertAtIndex, 0, section)
        }
    }

    removeSection(index: number) {
        this.sections.splice(index, 1)
    }

    splitSection(index: number, atMillis: bigint) {
        const section = this.sections[index]
        const left = { ...section, endTimeMillis: atMillis }
        const right = { ...section, startTimeMillis: atMillis, videoStartTimeMillies: atMillis }
        this.sections.splice(index, 1, left, right)
    }

    addOverlayToSection(sectionIndex: number, overlay: MediaOverlay) {
        this.sections[sectionIndex].overlays.push(overlay)
    }

    addVideoSection(video: MediaVideoMetadata) {
        const durationMillis = BigInt(Math.floor(video.duration * 1000))
        const section = create(PlaybackSectionSchema, {
            startTimeMillis: 0n,
            endTimeMillis: durationMillis,
            video,
            videoStartTimeMillies: 0n,
        })
        this.sections.push(section)
        this.selectedSectionIndex = this.sections.length - 1
    }

    loadSections(sections: PlaybackSection[]) {
        this.sections = sections
    }

    reset() {
        this.sections = []
        this.selectedSectionIndex = null
    }
}

export const editorStore = proxy(new EditorStore());