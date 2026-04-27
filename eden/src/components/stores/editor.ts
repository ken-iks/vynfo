import type {
  MediaOverlay,
  MediaVideoEffect,
  MediaVideoMetadata,
  PlaybackSection,
} from "@/gen/proto/v1/projects_pb";
import {
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

class EditorStore {
  sections: PlaybackSection[] = [];
  selectedSectionIndex: number | null = null;
  playbackTimeMillis = 0n;

  get totalDurationMillis(): bigint {
    return this.sections.reduce(
      (sum, s) => sum + (s.endTimeMillis - s.startTimeMillis),
      0n,
    );
  }

  selectSection(index: number | null) {
    this.selectedSectionIndex = index;
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
  }

  removeSection(index: number) {
    this.sections.splice(index, 1);
    if (this.selectedSectionIndex === index) {
      this.selectedSectionIndex = null;
    } else if (
      this.selectedSectionIndex !== null &&
      this.selectedSectionIndex > index
    ) {
      this.selectedSectionIndex -= 1;
    }
    this.rippleRecompute();
  }

  splitSection(index: number, atMillis: bigint) {
    const section = this.sections[index];
    const left = { ...section, endTimeMillis: atMillis };
    const right = {
      ...section,
      startTimeMillis: atMillis,
      video: section.video
        ? { ...section.video, videoStartTimeMillies: atMillis }
        : undefined,
    };
    this.sections.splice(index, 1, left, right);
    this.rippleRecompute();
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
  }

  addOverlayToSection(sectionIndex: number, overlay: MediaOverlay) {
    this.sections[sectionIndex].overlays.push(overlay);
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
    this.rippleRecompute();
  }

  loadSections(sections: PlaybackSection[]) {
    this.sections = sections;
    this.selectedSectionIndex = null;
    this.playbackTimeMillis = 0n;
    this.rippleRecompute();
  }

  reset() {
    this.sections = [];
    this.selectedSectionIndex = null;
    this.playbackTimeMillis = 0n;
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
