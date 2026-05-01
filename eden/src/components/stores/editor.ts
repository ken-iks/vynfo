import type {
  MediaOverlay,
  MediaImageMetadata,
  MediaTextMetadata,
  MediaVideoEffect,
  MediaVideoMetadata,
  PlaybackSection,
} from "@/gen/proto/v1/projects_pb";
import {
  MediaImageOverlaySchema,
  MediaOverlaySchema,
  MediaPositionSchema,
  MediaTextColor,
  MediaTextOverlaySchema,
  PlaybackSectionSchema,
  SectionVideoSchema,
} from "@/gen/proto/v1/projects_pb";
import { create } from "@bufbuild/protobuf";
import { proxy } from "valtio";

export const SNAP_MS = 500n;
export const MIN_DURATION_MS = 500n;

export function snap(ms: bigint): bigint {
  return (ms / SNAP_MS) * SNAP_MS;
}

export function sourceDurationMs(durationSeconds: number | undefined): bigint {
  if (!durationSeconds || durationSeconds <= 0) return 0n;
  return BigInt(Math.floor(durationSeconds * 1000));
}

interface SelectedOverlay {
  sectionIndex: number;
  overlayIndex: number;
}

class EditorStore {
  sections: PlaybackSection[] = [];
  selectedSectionIndex: number | null = null;
  selectedOverlay: SelectedOverlay | null = null;
  playbackTimeMillis = 0n;
  editRevision = 0;

  get totalDurationMillis(): bigint {
    return this.sections.reduce(
      (sum, s) => sum + (s.endTimeMillis - s.startTimeMillis),
      0n,
    );
  }

  get activeSectionIndex(): number | null {
    const activeIndex = this.sections.findIndex(
      (section) =>
        section.startTimeMillis <= this.playbackTimeMillis &&
        this.playbackTimeMillis < section.endTimeMillis,
    );
    return activeIndex >= 0 ? activeIndex : null;
  }

  get targetSectionIndex(): number | null {
    if (
      this.selectedSectionIndex !== null &&
      this.selectedSectionIndex >= 0 &&
      this.selectedSectionIndex < this.sections.length
    ) {
      return this.selectedSectionIndex;
    }

    return this.activeSectionIndex;
  }

  selectSection(index: number | null) {
    this.selectedSectionIndex = index;
    this.selectedOverlay = null;
  }

  selectOverlay(sectionIndex: number, overlayIndex: number) {
    this.selectedSectionIndex = sectionIndex;
    this.selectedOverlay = { sectionIndex, overlayIndex };
  }

  setPlaybackTimeSeconds(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0) {
      this.playbackTimeMillis = 0n;
      return;
    }

    this.playbackTimeMillis = BigInt(Math.floor(seconds * 1000));
  }

  setPlaybackTimeMillis(ms: bigint) {
    this.playbackTimeMillis = ms < 0n ? 0n : ms;
  }

  addSection(section: PlaybackSection, insertAtIndex?: number) {
    if (insertAtIndex === undefined) {
      this.sections.push(section);
    } else {
      this.sections.splice(insertAtIndex, 0, section);
    }
    this.rippleRecompute();
    this.markEdited();
  }

  removeSection(index: number) {
    this.sections.splice(index, 1);
    if (this.selectedSectionIndex === index) {
      this.selectedSectionIndex = null;
      this.selectedOverlay = null;
    } else if (
      this.selectedSectionIndex !== null &&
      this.selectedSectionIndex > index
    ) {
      this.selectedSectionIndex -= 1;
    }
    if (this.selectedOverlay?.sectionIndex === index) {
      this.selectedOverlay = null;
    } else if (
      this.selectedOverlay !== null &&
      this.selectedOverlay.sectionIndex > index
    ) {
      this.selectedOverlay = {
        ...this.selectedOverlay,
        sectionIndex: this.selectedOverlay.sectionIndex - 1,
      };
    }
    this.rippleRecompute();
    this.markEdited();
  }

  splitSection(index: number, atMillis: bigint) {
    const section = this.sections[index];
    if (!section) return;
    if (atMillis <= section.startTimeMillis) return;
    if (atMillis >= section.endTimeMillis) return;
    const splitOffset = atMillis - section.startTimeMillis;
    const left = {
      ...section,
      endTimeMillis: atMillis,
      overlays: [...section.overlays],
    };
    const right = {
      ...section,
      startTimeMillis: atMillis,
      overlays: [...section.overlays],
      video: section.video
        ? {
            ...section.video,
            effects: [...section.video.effects],
            videoStartTimeMillies:
              section.video.videoStartTimeMillies + splitOffset,
          }
        : undefined,
    };
    this.sections.splice(index, 1, left, right);
    this.rippleRecompute();
    this.markEdited();
  }

  trimStart(index: number, newDurationMs: bigint, newVideoStartMs: bigint) {
    const section = this.sections[index];
    if (!section.video) return;
    const sourceMs = sourceDurationMs(section.video.meta?.duration);

    const videoStart = snap(newVideoStartMs);
    const duration = snap(newDurationMs);
    if (videoStart < 0n) return;
    if (duration < MIN_DURATION_MS) return;
    if (videoStart + duration > sourceMs) return;

    this.sections[index] = {
      ...section,
      startTimeMillis: section.startTimeMillis,
      endTimeMillis: section.startTimeMillis + duration,
      video: { ...section.video, videoStartTimeMillies: videoStart },
    };
    this.rippleRecompute();
    this.markEdited();
  }

  trimEnd(index: number, newDurationMs: bigint) {
    const section = this.sections[index];
    if (!section.video) return;
    const sourceMs = sourceDurationMs(section.video.meta?.duration);
    const videoStart = section.video.videoStartTimeMillies;

    const duration = snap(newDurationMs);
    if (duration < MIN_DURATION_MS) return;
    if (videoStart + duration > sourceMs) return;

    this.sections[index] = {
      ...section,
      endTimeMillis: section.startTimeMillis + duration,
    };
    this.rippleRecompute();
    this.markEdited();
  }

  reorder(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= this.sections.length) return;
    if (toIndex < 0 || toIndex > this.sections.length) return;
    const [moved] = this.sections.splice(fromIndex, 1);
    const adjusted = toIndex > fromIndex ? toIndex - 1 : toIndex;
    this.sections.splice(adjusted, 0, moved);
    if (this.selectedSectionIndex === fromIndex) {
      this.selectedSectionIndex = adjusted;
    }
    this.rippleRecompute();
    this.markEdited();
  }

  addOverlayToSection(sectionIndex: number, overlay: MediaOverlay) {
    this.sections[sectionIndex].overlays.push(overlay);
    this.markEdited();
  }

  addImageOverlay(
    image: MediaImageMetadata,
    sectionIndex = this.targetSectionIndex,
  ): boolean {
    if (sectionIndex === null) return false;

    const overlay = create(MediaOverlaySchema, {
      assetId: image.assetId,
      assetType: {
        case: "image",
        value: create(MediaImageOverlaySchema, {
          pos: create(MediaPositionSchema, {
            leftCornerPx: 32n,
            leftCornerPy: 32n,
            size: 160n,
          }),
        }),
      },
    });
    this.addOverlayToSection(sectionIndex, overlay);
    this.selectOverlay(
      sectionIndex,
      this.sections[sectionIndex].overlays.length - 1,
    );
    return true;
  }

  addTextOverlay(
    text: MediaTextMetadata,
    sectionIndex = this.targetSectionIndex,
  ): boolean {
    if (sectionIndex === null) return false;

    const overlay = create(MediaOverlaySchema, {
      assetId: text.assetId,
      assetType: {
        case: "text",
        value: create(MediaTextOverlaySchema, {
          color: MediaTextColor.WHITE,
          pos: create(MediaPositionSchema, {
            leftCornerPx: 32n,
            leftCornerPy: 32n,
            size: 240n,
          }),
        }),
      },
    });
    this.addOverlayToSection(sectionIndex, overlay);
    this.selectOverlay(
      sectionIndex,
      this.sections[sectionIndex].overlays.length - 1,
    );
    return true;
  }

  updateOverlayPosition(
    sectionIndex: number,
    overlayIndex: number,
    leftPx: number,
    topPy: number,
    size: bigint,
  ) {
    const overlay = this.sections[sectionIndex]?.overlays[overlayIndex];
    if (!overlay) return;

    const pos = create(MediaPositionSchema, {
      leftCornerPx: BigInt(Math.max(0, Math.round(leftPx))),
      leftCornerPy: BigInt(Math.max(0, Math.round(topPy))),
      size,
    });

    if (overlay.assetType.case === "image") {
      overlay.assetType.value.pos = pos;
    } else if (overlay.assetType.case === "text") {
      overlay.assetType.value.pos = pos;
    }
    this.markEdited();
  }

  setTextOverlayColor(
    sectionIndex: number,
    overlayIndex: number,
    color: MediaTextColor,
  ) {
    const overlay = this.sections[sectionIndex]?.overlays[overlayIndex];
    if (overlay?.assetType.case !== "text") return;

    overlay.assetType.value.color = color;
    this.markEdited();
  }

  setSectionVideoEffects(sectionIndex: number, effects: MediaVideoEffect[]) {
    const section = this.sections[sectionIndex];
    if (!section?.video) return;

    this.sections[sectionIndex] = {
      ...section,
      video: {
        ...section.video,
        effects,
      },
    };
    this.markEdited();
  }

  addVideoSection(video: MediaVideoMetadata) {
    const durationMillis = snap(BigInt(Math.floor(video.duration * 1000)));
    const section = create(PlaybackSectionSchema, {
      startTimeMillis: 0n,
      endTimeMillis: durationMillis,
      video: create(SectionVideoSchema, {
        meta: video,
        videoStartTimeMillies: 0n,
      }),
    });
    this.sections.push(section);
    this.selectedSectionIndex = this.sections.length - 1;
    this.rippleRecompute();
    this.markEdited();
  }

  insertVideoAt(insertIndex: number, video: MediaVideoMetadata) {
    const durationMillis = snap(BigInt(Math.floor(video.duration * 1000)));
    const section = create(PlaybackSectionSchema, {
      startTimeMillis: 0n,
      endTimeMillis: durationMillis,
      video: create(SectionVideoSchema, {
        meta: video,
        videoStartTimeMillies: 0n,
      }),
    });
    const clamped = Math.max(0, Math.min(insertIndex, this.sections.length));
    this.sections.splice(clamped, 0, section);
    this.selectedSectionIndex = clamped;
    this.selectedOverlay = null;
    this.rippleRecompute();
    this.markEdited();
  }

  insertVideoAtMillis(insertTimeMillis: bigint, video: MediaVideoMetadata) {
    const durationMillis = snap(BigInt(Math.floor(video.duration * 1000)));
    const section = create(PlaybackSectionSchema, {
      startTimeMillis: 0n,
      endTimeMillis: durationMillis,
      video: create(SectionVideoSchema, {
        meta: video,
        videoStartTimeMillies: 0n,
      }),
    });
    return this.insertSectionAtMillis(insertTimeMillis, section);
  }

  insertSectionAtMillis(insertTimeMillis: bigint, section: PlaybackSection) {
    const durationMillis = section.endTimeMillis - section.startTimeMillis;
    if (durationMillis < MIN_DURATION_MS) return false;

    const newSection = {
      ...section,
      startTimeMillis: 0n,
      endTimeMillis: durationMillis,
      overlays: [...section.overlays],
      video: section.video
        ? {
            ...section.video,
            effects: [...section.video.effects],
          }
        : undefined,
    };
    const insertTime = snap(insertTimeMillis);
    let inserted = false;

    for (let i = 0; i < this.sections.length; i++) {
      const currSection = this.sections[i];
      if (insertTime <= currSection.startTimeMillis) {
        this.sections.splice(i, 0, newSection);
        this.selectedSectionIndex = i;
        inserted = true;
        break;
      }

      if (insertTime < currSection.endTimeMillis) {
        const splitOffset = insertTime - currSection.startTimeMillis;
        const left = {
          ...currSection,
          endTimeMillis: insertTime,
          overlays: [...currSection.overlays],
        };
        const right = {
          ...currSection,
          startTimeMillis: insertTime,
          overlays: [...currSection.overlays],
          video: currSection.video
            ? {
                ...currSection.video,
                effects: [...currSection.video.effects],
                videoStartTimeMillies:
                  currSection.video.videoStartTimeMillies + splitOffset,
              }
            : undefined,
        };
        this.sections.splice(i, 1, left, newSection, right);
        this.selectedSectionIndex = i + 1;
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      this.sections.push(newSection);
      this.selectedSectionIndex = this.sections.length - 1;
    }
    this.selectedOverlay = null;
    this.rippleRecompute();
    this.markEdited();
    return true;
  }

  loadSections(sections: PlaybackSection[]) {
    this.sections = sections;
    this.selectedSectionIndex = null;
    this.selectedOverlay = null;
    this.playbackTimeMillis = 0n;
    this.rippleRecompute();
    this.editRevision = 0;
  }

  reset() {
    this.sections = [];
    this.selectedSectionIndex = null;
    this.selectedOverlay = null;
    this.playbackTimeMillis = 0n;
    this.editRevision = 0;
  }

  private markEdited() {
    this.editRevision += 1;
  }

  private rippleRecompute() {
    let running = 0n;
    for (let i = 0; i < this.sections.length; i++) {
      const s = this.sections[i];
      const duration = s.endTimeMillis - s.startTimeMillis;
      if (
        s.startTimeMillis !== running ||
        s.endTimeMillis !== running + duration
      ) {
        this.sections[i] = {
          ...s,
          startTimeMillis: running,
          endTimeMillis: running + duration,
        };
      }
      running += duration;
    }
  }
}

export const editorStore = proxy(new EditorStore());
