import {
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { useCallback, useEffect, useState } from "react";
import { useSnapshot } from "valtio";
import type {
  MediaAudioMetadata,
  MediaImageMetadata,
  MediaVideoMetadata,
  PlaybackSection,
} from "@/gen/proto/v1/projects_pb";
import { editorStore } from "../stores/editor";
import { TimelineSection } from "./TimelineSection";
import { TimelineRuler } from "./TimelineRuler";
import { TimelineContextMenu } from "./TimelineContextMenu";
import { EffectsComposer } from "./EffectsComposer";
import { AudioTimelineSection } from "./AudioTimelineSection";
import { useTimelineReorder } from "./hooks/useTimelineReorder";
import { msToPx, pxToMs } from "./geometry";
import { ContextMenu, ContextMenuTrigger } from "../ui/context-menu";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTimelineLayout } from "./hooks/useTimelineLayout";
import { useTimelineContextMenu } from "./hooks/useTimelineContextMenu";
import { useTimelineSeeking } from "./hooks/useTimelineSeeking";
import { useTimelineZoom } from "./hooks/useTimelineZoom";
import {
  GROUP_HEADER_HEIGHT,
  HORIZONTAL_SCROLLBAR_GUTTER,
  LABEL_WIDTH,
  LANE_HEIGHT,
  MAX_ZOOM_LEVEL,
  RULER_HEIGHT,
} from "./timelineConstants";

interface TimelineTrackProps {
  availableVideos: MediaVideoMetadata[];
  availableAudios: MediaAudioMetadata[];
  availableImages: MediaImageMetadata[];
}

export function TimelineTrack({
  availableVideos,
  availableAudios,
  availableImages,
}: TimelineTrackProps) {
  const editorSnapshot = useSnapshot(editorStore);
  const totalDuration = editorSnapshot.totalDurationMillis;

  const {
    naturalTrackWidth,
    pxPerSecond,
    setZoomLevel,
    trackWidth,
    viewportRef,
    zoomLevel,
  } = useTimelineZoom(totalDuration);
  const timelineLayout = useTimelineLayout({
    availableAudios,
    availableVideos,
    audioSections: editorSnapshot.audioSections,
    sections: editorSnapshot.sections,
  });
  const timelineHeight = timelineLayout.totalLaneHeight;
  const timelineContentHeight = timelineHeight + RULER_HEIGHT;
  const timelineScrollHeight =
    timelineContentHeight + HORIZONTAL_SCROLLBAR_GUTTER;
  const {
    beginTimelineSeek,
    clampTrackPx,
    clientXToTrackPx,
    hoverTrackPx,
    setHoverTrackPx,
    updateHoverTrackPx,
  } = useTimelineSeeking({
    naturalTrackWidth,
    pxPerSecond,
    totalDuration,
    viewportRef,
  });
  const { handleTrackContextMenu, menuContext, setMenuContext } =
    useTimelineContextMenu({
      clientXToTrackPx,
    });

  const { reorder, handleBeginReorder, previewLefts } = useTimelineReorder({
    sections: editorSnapshot.sections,
    pxPerSecond,
    clientXToTrackPx,
  });

  const playheadLeft = msToPx(editorSnapshot.playbackTimeMillis, pxPerSecond);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || totalDuration <= 0n) return;

    const padding = 24;
    const visibleLeft = viewport.scrollLeft;
    const visibleRight = visibleLeft + viewport.clientWidth;

    if (playheadLeft < visibleLeft + padding) {
      viewport.scrollLeft = Math.max(0, playheadLeft - padding);
      return;
    }

    if (playheadLeft > visibleRight - padding) {
      viewport.scrollLeft = Math.min(
        trackWidth - viewport.clientWidth,
        playheadLeft - viewport.clientWidth + padding,
      );
    }
  }, [playheadLeft, totalDuration, trackWidth]);

  const [effectsSectionIndex, setEffectsSectionIndex] = useState<number | null>(
    null,
  );

  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      const target = ev.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (ev.key === "Delete" || ev.key === "Backspace") {
        const idx = editorStore.selectedSectionIndex;
        if (idx !== null) {
          ev.preventDefault();
          editorStore.removeSection(idx);
          return;
        }
        const audioIdx = editorStore.selectedAudioSectionIndex;
        if (audioIdx !== null) {
          ev.preventDefault();
          editorStore.removeAudioSection(audioIdx);
        }
      } else if (ev.key === "Escape") {
        editorStore.selectSection(null);
        editorStore.selectAudioSection(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const insertVideoAtTrackPx = useCallback(
    (trackPx: number, video: MediaVideoMetadata) => {
      const insertTimeMillis = pxToMs(clampTrackPx(trackPx), pxPerSecond);
      editorStore.insertVideoAtMillis(insertTimeMillis, video);
    },
    [clampTrackPx, pxPerSecond],
  );

  const insertAudioAtTrackPx = useCallback(
    (trackPx: number, audio: MediaAudioMetadata) => {
      const insertTimeMillis = pxToMs(clampTrackPx(trackPx), pxPerSecond);
      editorStore.addAudioAtMillis(insertTimeMillis, audio);
    },
    [clampTrackPx, pxPerSecond],
  );

  const cutAtTrackPx = useCallback(
    (
      trackPx: number,
      sectionIndex: number | null,
      audioSectionIndex: number | null,
    ) => {
      const atMillis = pxToMs(clampTrackPx(trackPx), pxPerSecond);
      if (sectionIndex !== null) {
        editorStore.splitSection(sectionIndex, atMillis);
      }
      if (audioSectionIndex !== null) {
        editorStore.splitAudioSection(audioSectionIndex, atMillis);
      }
    },
    [clampTrackPx, pxPerSecond],
  );

  const pasteSectionAtTrackPx = useCallback(
    (trackPx: number, section: PlaybackSection) => {
      const insertTimeMillis = pxToMs(clampTrackPx(trackPx), pxPerSecond);
      editorStore.insertSectionAtMillis(insertTimeMillis, section);
    },
    [clampTrackPx, pxPerSecond],
  );

  const addLaneSource = useCallback(
    (kind: "audio" | "video", assetId: string | undefined) => {
      if (assetId === undefined) return;
      if (kind === "video") {
        const video = availableVideos.find((v) => v.assetId === assetId);
        if (video === undefined) return;
        editorStore.addVideoSection(video);
        return;
      }

      const audio = availableAudios.find((a) => a.assetId === assetId);
      if (audio === undefined) return;
      editorStore.addAudioAtNextAvailable(audio);
    },
    [availableAudios, availableVideos],
  );

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 w-full flex-1 flex-col gap-2",
        "overflow-hidden",
      )}
    >
      <div className="flex items-center justify-end gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom out timeline"
          disabled={zoomLevel === 0}
          onClick={() => setZoomLevel((level) => Math.max(0, level - 1))}
        >
          <MagnifyingGlassMinusIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom in timeline"
          disabled={zoomLevel === MAX_ZOOM_LEVEL}
          onClick={() =>
            setZoomLevel((level) => Math.min(MAX_ZOOM_LEVEL, level + 1))
          }
        >
          <MagnifyingGlassPlusIcon />
        </Button>
      </div>
      <ContextMenu
        onOpenChange={(open) => {
          if (!open) setMenuContext(null);
        }}
      >
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              "flex min-h-0 min-w-0 w-full flex-1 overflow-x-hidden overflow-y-auto",
              "rounded-none border border-border bg-muted/10",
            )}
          >
            <div
              className="shrink-0 border-r border-border bg-background/40"
              style={{
                width: LABEL_WIDTH,
                minHeight: timelineScrollHeight,
              }}
            >
              <div className="h-[22px] border-b border-border/60" />
              <div className="relative" style={{ height: timelineHeight }}>
                {timelineLayout.groupHeaders.map((header) => (
                  <div
                    key={header.key}
                    className="absolute inset-x-0 flex items-center border-b border-border/60 bg-muted/30 px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                    style={{
                      top: header.topPx,
                      height: GROUP_HEADER_HEIGHT,
                    }}
                  >
                    {header.title}
                  </div>
                ))}
                {timelineLayout.lanes.map((lane) => (
                  <div
                    key={lane.key}
                    className="group/lane-label absolute inset-x-0 flex items-center gap-1 border-b border-border/40 px-2 text-left text-[10px] font-medium text-muted-foreground hover:bg-muted/40"
                    style={{
                      top: lane.topPx,
                      height: LANE_HEIGHT,
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {lane.title}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="size-5 opacity-0 group-hover/lane-label:opacity-100"
                      disabled={lane.assetId === undefined}
                      aria-label={`Add ${lane.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        addLaneSource(lane.kind, lane.assetId);
                      }}
                    >
                      <PlusIcon />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <div
              className={cn(
                "relative min-w-0 flex-1 self-start",
                "overflow-x-auto overflow-y-hidden",
              )}
              style={{ height: timelineScrollHeight }}
              onContextMenu={handleTrackContextMenu}
              onPointerMove={(e) => updateHoverTrackPx(e.clientX)}
              onPointerLeave={() => setHoverTrackPx(null)}
              ref={viewportRef}
            >
              {/* Keep zoomed track width out of normal layout so it only affects this scroller. */}
              <div
                className="absolute top-0 left-0"
                style={{
                  height: timelineContentHeight,
                  width: trackWidth,
                }}
              >
                <div
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    e.preventDefault();
                    editorStore.selectSection(null);
                    beginTimelineSeek(e.clientX);
                  }}
                >
                  <TimelineRuler
                    totalDurationMillis={totalDuration}
                    pxPerSecond={pxPerSecond}
                    height={RULER_HEIGHT}
                  />
                </div>
                <div
                  className="relative"
                  style={{ height: timelineHeight, width: trackWidth }}
                  onPointerDown={(e) => {
                    if (e.target === e.currentTarget) {
                      editorStore.selectSection(null);
                      beginTimelineSeek(e.clientX);
                    }
                  }}
                >
                  {timelineLayout.lanes.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      Upload a video to create a timeline track
                    </div>
                  ) : (
                    <>
                      {timelineLayout.groupHeaders.map((header) => (
                        <div
                          key={header.key}
                          className="absolute inset-x-0 border-b border-border/60 bg-muted/20"
                          style={{
                            top: header.topPx,
                            height: GROUP_HEADER_HEIGHT,
                          }}
                        />
                      ))}
                      {timelineLayout.lanes.map((lane) => (
                        <div
                          key={lane.key}
                          className={cn(
                            "absolute inset-x-0 rounded-sm border border-border/60 text-left hover:bg-muted/30",
                            lane.kind === "audio"
                              ? "bg-emerald-950/20"
                              : "bg-background/30",
                          )}
                          style={{
                            top: lane.topPx,
                            height: LANE_HEIGHT,
                          }}
                          onPointerDown={(e) => {
                            if (e.button !== 0) return;
                            e.preventDefault();
                            editorStore.selectSection(null);
                            beginTimelineSeek(e.clientX);
                          }}
                        >
                          <span className="sr-only">{lane.title}</span>
                        </div>
                      ))}
                      {reorder && (
                        <div
                          className={cn(
                            "pointer-events-none absolute",
                            "rounded-none bg-card/50 backdrop-blur-sm",
                            "ring-1 ring-dashed ring-primary/60",
                          )}
                          style={{
                            top:
                              timelineLayout.lanes[
                                timelineLayout.sectionLaneIndices[
                                  reorder.fromIndex
                                ]
                              ]?.topPx ?? 0,
                            left: msToPx(
                              editorSnapshot.sections[reorder.fromIndex]
                                .startTimeMillis,
                              pxPerSecond,
                            ),
                            width: msToPx(
                              editorSnapshot.sections[reorder.fromIndex]
                                .endTimeMillis -
                                editorSnapshot.sections[reorder.fromIndex]
                                  .startTimeMillis,
                              pxPerSecond,
                            ),
                            height: LANE_HEIGHT,
                          }}
                        >
                          <div
                            className={cn(
                              "flex h-full items-center justify-center",
                              "text-[10px] font-medium uppercase tracking-wider",
                              "text-muted-foreground/80",
                            )}
                          >
                            Moving
                          </div>
                        </div>
                      )}
                      {editorSnapshot.sections.map((section, i) => {
                        const sectionDuration =
                          section.endTimeMillis - section.startTimeMillis;
                        const naturalLeft = msToPx(
                          section.startTimeMillis,
                          pxPerSecond,
                        );
                        const widthPx = msToPx(sectionDuration, pxPerSecond);
                        const isBeingDragged = reorder?.fromIndex === i;
                        const previewLeft = previewLefts?.[i] ?? naturalLeft;
                        const laneIndex = timelineLayout.sectionLaneIndices[i];
                        const topPx =
                          timelineLayout.lanes[laneIndex]?.topPx ?? 0;
                        const dragOffsetPx =
                          isBeingDragged && reorder
                            ? reorder.currentClientX - reorder.startClientX
                            : 0;
                        const leftPx = isBeingDragged
                          ? naturalLeft
                          : previewLeft;
                        return (
                          <TimelineSection
                            key={i}
                            section={section}
                            index={i}
                            isSelected={
                              editorSnapshot.selectedSectionIndex === i
                            }
                            leftPx={leftPx}
                            topPx={topPx}
                            widthPx={widthPx}
                            heightPx={LANE_HEIGHT}
                            pxPerSecond={pxPerSecond}
                            isBeingDragged={isBeingDragged}
                            isAnyDragActive={reorder !== null}
                            dragOffsetPx={dragOffsetPx}
                            onBeginReorder={handleBeginReorder}
                          />
                        );
                      })}
                      {editorSnapshot.audioSections.map((section, i) => (
                        <AudioTimelineSection
                          key={i}
                          section={section}
                          index={i}
                          isSelected={
                            editorSnapshot.selectedAudioSectionIndex === i
                          }
                          topPx={
                            timelineLayout.lanes[
                              timelineLayout.audioSectionLaneIndices[i]
                            ]?.topPx ?? 0
                          }
                          pxPerSecond={pxPerSecond}
                          totalDuration={totalDuration}
                        />
                      ))}
                      {totalDuration > 0n && (
                        <div
                          className="absolute top-0 bottom-0 z-20 w-px cursor-ew-resize bg-primary"
                          style={{
                            left: Math.min(
                              Math.max(playheadLeft, 0),
                              trackWidth,
                            ),
                          }}
                          onPointerDown={(e) => {
                            if (e.button !== 0) return;
                            e.preventDefault();
                            e.stopPropagation();
                            beginTimelineSeek(e.clientX);
                          }}
                        >
                          <div className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rotate-45 bg-primary" />
                        </div>
                      )}
                    </>
                  )}
                </div>
                {hoverTrackPx !== null && totalDuration > 0n && (
                  <div
                    className="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-foreground/40"
                    style={{ left: hoverTrackPx }}
                  >
                    <div className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rotate-45 border border-foreground/50 bg-background" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </ContextMenuTrigger>
        <TimelineContextMenu
          menuContext={menuContext}
          availableVideos={availableVideos}
          availableAudios={availableAudios}
          availableImages={availableImages}
          onInsertVideoAtTrackPx={insertVideoAtTrackPx}
          onInsertAudioAtTrackPx={insertAudioAtTrackPx}
          onCutAtTrackPx={cutAtTrackPx}
          onPasteSectionAtTrackPx={pasteSectionAtTrackPx}
          onEditEffects={(sectionIndex) => {
            editorStore.selectSection(sectionIndex);
            setEffectsSectionIndex(sectionIndex);
          }}
        />
      </ContextMenu>
      <EffectsComposer
        open={effectsSectionIndex !== null}
        sectionIndex={effectsSectionIndex}
        onOpenChange={(open) => {
          if (!open) setEffectsSectionIndex(null);
        }}
      />
    </div>
  );
}
