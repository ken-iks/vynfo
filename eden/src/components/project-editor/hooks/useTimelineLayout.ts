import { useMemo } from "react";
import type {
  MediaAudioMetadata,
  MediaVideoMetadata,
} from "@/gen/proto/v1/projects_pb";
import {
  EMPTY_TIMELINE_HEIGHT,
  GROUP_HEADER_HEIGHT,
  LANE_GAP,
  LANE_HEIGHT,
} from "../timelineConstants";

interface SectionLike {
  video?: {
    meta?: {
      assetId: string;
      title: string;
    };
  };
}

interface AudioSectionLike {
  audio?: {
    meta?: {
      assetId: string;
      title: string;
    };
  };
}

export interface TimelineLane {
  key: string;
  title: string;
  kind: "audio" | "video";
  topPx: number;
}

export interface TimelineGroupHeader {
  key: string;
  title: string;
  topPx: number;
}

interface UseTimelineLayoutArgs {
  availableVideos: readonly MediaVideoMetadata[];
  availableAudios: readonly MediaAudioMetadata[];
  sections: readonly SectionLike[];
  audioSections: readonly AudioSectionLike[];
}

export function useTimelineLayout({
  availableVideos,
  availableAudios,
  sections,
  audioSections,
}: UseTimelineLayoutArgs) {
  return useMemo(() => {
    const lanes: TimelineLane[] = [];
    const groupHeaders: TimelineGroupHeader[] = [];
    const sectionLaneIndices: number[] = [];
    const audioSectionLaneIndices: number[] = [];
    const laneIndicesByKey = new Map<string, number>();
    let nextTopPx = 0;

    const addGroupHeader = (key: string, title: string) => {
      groupHeaders.push({
        key,
        title,
        topPx: nextTopPx,
      });
      nextTopPx += GROUP_HEADER_HEIGHT;
    };

    const addLane = (
      key: string,
      title: string,
      kind: "audio" | "video",
    ): number => {
      const existingLaneIndex = laneIndicesByKey.get(key);
      if (existingLaneIndex !== undefined) return existingLaneIndex;
      const laneIndex = lanes.length;
      laneIndicesByKey.set(key, laneIndex);
      lanes.push({
        key,
        title,
        kind,
        topPx: nextTopPx,
      });
      nextTopPx += LANE_HEIGHT + LANE_GAP;
      return laneIndex;
    };

    const hasVideoTracks = availableVideos.length > 0 || sections.length > 0;
    if (hasVideoTracks) {
      addGroupHeader("video", "Video Tracks");
      for (const video of availableVideos) {
        if (!video.assetId) continue;
        addLane(`video-${video.assetId}`, video.title || "Untitled", "video");
      }
    }

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const key = section.video?.meta?.assetId
        ? `video-${section.video.meta.assetId}`
        : `section-${i}`;
      sectionLaneIndices[i] = addLane(
        key,
        section.video?.meta?.title ?? "Untitled",
        "video",
      );
    }

    const hasAudioTracks =
      availableAudios.length > 0 || audioSections.length > 0;
    if (hasAudioTracks) {
      addGroupHeader("audio", "Audio Tracks");
      for (const audio of availableAudios) {
        if (!audio.assetId) continue;
        addLane(`audio-${audio.assetId}`, audio.title || "Untitled", "audio");
      }
    }

    for (let i = 0; i < audioSections.length; i++) {
      const section = audioSections[i];
      const key = section.audio?.meta?.assetId
        ? `audio-${section.audio.meta.assetId}`
        : `audio-section-${i}`;
      audioSectionLaneIndices[i] = addLane(
        key,
        section.audio?.meta?.title ?? "Untitled",
        "audio",
      );
    }

    const totalLaneHeight =
      lanes.length === 0 ? EMPTY_TIMELINE_HEIGHT : nextTopPx - LANE_GAP;

    return {
      audioSectionLaneIndices,
      groupHeaders,
      lanes,
      sectionLaneIndices,
      totalLaneHeight,
    };
  }, [availableAudios, availableVideos, audioSections, sections]);
}
