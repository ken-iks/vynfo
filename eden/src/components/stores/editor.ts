import type {
  MediaOverlay,
  MediaAudioMetadata,
  MediaImageMetadata,
  MediaVideoEffect,
  MediaVideoMetadata,
  PlaybackAudio,
  PlaybackSection,
  PlaybackState,
} from "@/gen/proto/v1/projects_pb";
import {
  MediaImageOverlaySchema,
  MediaOverlaySchema,
  MediaPositionSchema,
  MediaTextColor,
  MediaTextOverlaySchema,
  PlaybackAudioSchema,
  PlaybackSectionSchema,
  PlaybackStateSchema,
  SectionAudioSchema,
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
  audioSections: PlaybackAudio[] = [];
  selectedSectionIndex: number | null = null;
  selectedAudioSectionIndex: number | null = null;
  selectedOverlay: SelectedOverlay | null = null;
  playbackTimeMillis = 0n;
  editRevision = 0;

  get videoDurationMillis(): bigint {
    return this.sections.reduce(
      (sum, s) => sum + (s.endTimeMillis - s.startTimeMillis),
      0n,
    );
  }

  get totalDurationMillis(): bigint {
    return this.videoDurationMillis;
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
    this.selectedAudioSectionIndex = null;
    this.selectedOverlay = null;
  }

  selectAudioSection(index: number | null) {
    this.selectedAudioSectionIndex = index;
    this.selectedSectionIndex = null;
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
    this.clampAudioSectionsToVideoDuration();
    this.markEdited();
  }

  addAudioAtMillis(insertTimeMillis: bigint, audio: MediaAudioMetadata) {
    const videoDuration = this.videoDurationMillis;
    const start = insertTimeMillis;
    if (start >= videoDuration) return false;

    const sourceMs = sourceDurationMs(audio.duration);
    const timelineRemaining = videoDuration - start;
    const maxDuration =
      sourceMs < timelineRemaining ? sourceMs : timelineRemaining;
    const durationMillis = maxDuration;
    if (durationMillis < MIN_DURATION_MS) return false;

    const section = create(PlaybackAudioSchema, {
      startTimeMillis: start,
      endTimeMillis: start + durationMillis,
      audio: create(SectionAudioSchema, {
        meta: audio,
        audioStartTimeMillies: 0n,
      }),
    });
    if (this.audioOverlaps(section, null)) return false;
    this.audioSections.push(section);
    this.sortAudioSections();
    this.selectedAudioSectionIndex = this.audioSections.indexOf(section);
    this.selectedSectionIndex = null;
    this.selectedOverlay = null;
    this.markEdited();
    return true;
  }

  addAudioAtNextAvailable(audio: MediaAudioMetadata) {
    const videoDuration = this.videoDurationMillis;
    const sourceMs = sourceDurationMs(audio.duration);
    if (videoDuration < MIN_DURATION_MS) return false;
    if (sourceMs < MIN_DURATION_MS) return false;

    const sortedSections = [...this.audioSections].sort((a, b) => {
      if (a.startTimeMillis < b.startTimeMillis) return -1;
      if (a.startTimeMillis > b.startTimeMillis) return 1;
      return 0;
    });
    let gapStart = 0n;

    for (const section of sortedSections) {
      if (section.startTimeMillis > gapStart) {
        const gapDuration = section.startTimeMillis - gapStart;
        if (gapDuration >= MIN_DURATION_MS) {
          return this.addAudioAtMillis(gapStart, audio);
        }
      }
      if (section.endTimeMillis > gapStart) {
        gapStart = section.endTimeMillis;
      }
    }

    if (videoDuration - gapStart < MIN_DURATION_MS) return false;
    return this.addAudioAtMillis(gapStart, audio);
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
    this.clampAudioSectionsToVideoDuration();
    this.markEdited();
  }

  removeAudioSection(index: number) {
    this.audioSections.splice(index, 1);
    if (this.selectedAudioSectionIndex === index) {
      this.selectedAudioSectionIndex = null;
    } else if (
      this.selectedAudioSectionIndex !== null &&
      this.selectedAudioSectionIndex > index
    ) {
      this.selectedAudioSectionIndex -= 1;
    }
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

  splitAudioSection(index: number, atMillis: bigint) {
    const section = this.audioSections[index];
    if (!section) return;
    if (!section.audio) return;
    if (atMillis <= section.startTimeMillis) return;
    if (atMillis >= section.endTimeMillis) return;
    const splitOffset = atMillis - section.startTimeMillis;
    const left = {
      ...section,
      endTimeMillis: atMillis,
    };
    const right = {
      ...section,
      startTimeMillis: atMillis,
      audio: {
        ...section.audio,
        audioStartTimeMillies:
          section.audio.audioStartTimeMillies + splitOffset,
      },
    };
    this.audioSections.splice(index, 1, left, right);
    this.selectedAudioSectionIndex = index + 1;
    this.clampAudioSectionsToVideoDuration();
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
    this.clampAudioSectionsToVideoDuration();
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
    this.clampAudioSectionsToVideoDuration();
    this.markEdited();
  }

  trimAudioStart(
    index: number,
    newDurationMs: bigint,
    newAudioStartMs: bigint,
  ) {
    const section = this.audioSections[index];
    if (!section.audio) return;
    const sourceMs = sourceDurationMs(section.audio.meta?.duration);

    const audioStart = newAudioStartMs;
    const duration = newDurationMs;
    if (audioStart < 0n) return;
    if (duration < MIN_DURATION_MS) return;
    if (audioStart + duration > sourceMs) return;
    if (section.startTimeMillis + duration > this.videoDurationMillis) return;

    const nextSection = {
      ...section,
      endTimeMillis: section.startTimeMillis + duration,
      audio: { ...section.audio, audioStartTimeMillies: audioStart },
    };
    if (this.audioOverlaps(nextSection, index)) return;
    this.audioSections[index] = nextSection;
    this.markEdited();
  }

  trimAudioEnd(index: number, newDurationMs: bigint) {
    const section = this.audioSections[index];
    if (!section.audio) return;
    const sourceMs = sourceDurationMs(section.audio.meta?.duration);
    const audioStart = section.audio.audioStartTimeMillies;

    const duration = newDurationMs;
    if (duration < MIN_DURATION_MS) return;
    if (audioStart + duration > sourceMs) return;
    if (section.startTimeMillis + duration > this.videoDurationMillis) return;

    const nextSection = {
      ...section,
      endTimeMillis: section.startTimeMillis + duration,
    };
    if (this.audioOverlaps(nextSection, index)) return;
    this.audioSections[index] = nextSection;
    this.markEdited();
  }

  moveAudioSection(index: number, newStartTimeMillis: bigint) {
    const section = this.audioSections[index];
    if (!section?.audio) return;
    const duration = section.endTimeMillis - section.startTimeMillis;
    const maxStart = this.videoDurationMillis - duration;
    if (duration < MIN_DURATION_MS) return;
    if (maxStart < 0n) return;

    let startTimeMillis = newStartTimeMillis;
    if (startTimeMillis < 0n) {
      startTimeMillis = 0n;
    }
    if (startTimeMillis > maxStart) {
      startTimeMillis = maxStart;
    }
    if (startTimeMillis === section.startTimeMillis) return;

    const nextSection = {
      ...section,
      startTimeMillis,
      endTimeMillis: startTimeMillis + duration,
    };
    if (this.audioOverlaps(nextSection, index)) return;

    this.audioSections[index] = nextSection;
    this.sortAudioSections();
    this.selectedAudioSectionIndex = this.audioSections.indexOf(nextSection);
    this.markEdited();
  }

  slipAudioSource(index: number, newAudioStartMs: bigint) {
    const section = this.audioSections[index];
    if (!section?.audio) return;
    const duration = section.endTimeMillis - section.startTimeMillis;
    const sourceMs = sourceDurationMs(section.audio.meta?.duration);
    if (duration < MIN_DURATION_MS) return;
    if (duration > sourceMs) return;

    let audioStart = newAudioStartMs;
    const maxAudioStart = sourceMs - duration;
    if (audioStart < 0n) {
      audioStart = 0n;
    }
    if (audioStart > maxAudioStart) {
      audioStart = maxAudioStart;
    }

    this.audioSections[index] = {
      ...section,
      audio: { ...section.audio, audioStartTimeMillies: audioStart },
    };
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
    this.clampAudioSectionsToVideoDuration();
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
      kind: {
        case: "image",
        value: create(MediaImageOverlaySchema, {
          assetId: image.assetId,
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
    content: string,
    sectionIndex = this.targetSectionIndex,
  ): boolean {
    if (sectionIndex === null) return false;

    const overlay = create(MediaOverlaySchema, {
      kind: {
        case: "text",
        value: create(MediaTextOverlaySchema, {
          color: MediaTextColor.WHITE,
          content,
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

    if (overlay.kind.case === "image") {
      overlay.kind.value.pos = pos;
    } else if (overlay.kind.case === "text") {
      overlay.kind.value.pos = pos;
    }
    this.markEdited();
  }

  setTextOverlayColor(
    sectionIndex: number,
    overlayIndex: number,
    color: MediaTextColor,
  ) {
    const overlay = this.sections[sectionIndex]?.overlays[overlayIndex];
    if (overlay?.kind.case !== "text") return;

    overlay.kind.value.color = color;
    this.markEdited();
  }

  setTextOverlayContent(
    sectionIndex: number,
    overlayIndex: number,
    content: string,
  ) {
    const overlay = this.sections[sectionIndex]?.overlays[overlayIndex];
    if (overlay?.kind.case !== "text") return;

    overlay.kind.value.content = content;
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
    this.clampAudioSectionsToVideoDuration();
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
    this.clampAudioSectionsToVideoDuration();
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
    this.clampAudioSectionsToVideoDuration();
    this.markEdited();
    return true;
  }

  loadSections(sections: PlaybackSection[]) {
    this.sections = sections;
    this.audioSections = [];
    this.selectedSectionIndex = null;
    this.selectedAudioSectionIndex = null;
    this.selectedOverlay = null;
    this.playbackTimeMillis = 0n;
    this.rippleRecompute();
    this.clampAudioSectionsToVideoDuration();
    this.editRevision = 0;
  }

  loadState(state: PlaybackState | undefined) {
    this.sections = state?.videoSections ? [...state.videoSections] : [];
    this.audioSections = state?.audioSections ? [...state.audioSections] : [];
    this.sortAudioSections();
    this.selectedSectionIndex = null;
    this.selectedAudioSectionIndex = null;
    this.selectedOverlay = null;
    this.playbackTimeMillis = 0n;
    this.rippleRecompute();
    this.clampAudioSectionsToVideoDuration();
    this.editRevision = 0;
  }

  currentState(): PlaybackState {
    return create(PlaybackStateSchema, {
      videoSections: [...this.sections],
      audioSections: [...this.audioSections],
    });
  }

  reset() {
    this.sections = [];
    this.audioSections = [];
    this.selectedSectionIndex = null;
    this.selectedAudioSectionIndex = null;
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

  private clampAudioSectionsToVideoDuration() {
    const videoDuration = this.videoDurationMillis;
    const selectedIndex = this.selectedAudioSectionIndex;
    const nextAudioSections: PlaybackAudio[] = [];
    let nextSelectedIndex: number | null = null;

    for (let i = 0; i < this.audioSections.length; i++) {
      const section = this.audioSections[i];
      if (!section.audio) continue;
      if (section.startTimeMillis >= videoDuration) continue;

      const sourceMs = sourceDurationMs(section.audio.meta?.duration);
      const audioStart = section.audio.audioStartTimeMillies;
      if (audioStart >= sourceMs) continue;

      const sourceEndMillis =
        section.startTimeMillis + (sourceMs - audioStart);
      let endTimeMillis =
        section.endTimeMillis < videoDuration
          ? section.endTimeMillis
          : videoDuration;
      if (endTimeMillis > sourceEndMillis) {
        endTimeMillis = sourceEndMillis;
      }
      if (endTimeMillis - section.startTimeMillis < MIN_DURATION_MS) continue;

      const nextSection =
        endTimeMillis === section.endTimeMillis
          ? section
          : { ...section, endTimeMillis };
      if (selectedIndex === i) {
        nextSelectedIndex = nextAudioSections.length;
      }
      nextAudioSections.push(nextSection);
    }

    this.audioSections = nextAudioSections;
    this.selectedAudioSectionIndex = nextSelectedIndex;
    this.sortAudioSections();
  }

  private audioOverlaps(section: PlaybackAudio, ignoreIndex: number | null) {
    return this.audioSections.some((existing, index) => {
      if (ignoreIndex !== null && index === ignoreIndex) return false;
      return (
        section.startTimeMillis < existing.endTimeMillis &&
        existing.startTimeMillis < section.endTimeMillis
      );
    });
  }

  private sortAudioSections() {
    this.audioSections.sort((a, b) => {
      if (a.startTimeMillis < b.startTimeMillis) return -1;
      if (a.startTimeMillis > b.startTimeMillis) return 1;
      return 0;
    });
  }
}

export const editorStore = proxy(new EditorStore());
