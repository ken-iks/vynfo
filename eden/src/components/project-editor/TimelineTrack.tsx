import {
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
} from "@heroicons/react/24/outline";
import { useCallback, useEffect, useState } from "react";
import { useSnapshot } from "valtio";
import type {
  MediaAudioMetadata,
  MediaImageMetadata,
  MediaVideoMetadata,
  PlaybackSection,
} from "@/gen/proto/v1/projects_pb";
import { editorStore, snap, sourceDurationMs } from "../stores/editor";
import { TimelineSection } from "./TimelineSection";
import { TimelineRuler } from "./TimelineRuler";
import { TimelineContextMenu } from "./TimelineContextMenu";
import { EffectsComposer } from "./EffectsComposer";
import { useTimelineReorder } from "./hooks/useTimelineReorder";
import { msToPx, pxToMs } from "./geometry";
import { ContextMenu, ContextMenuTrigger } from "../ui/context-menu";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/utils/timestamp-conversaions";
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
                    className="absolute inset-x-0 flex items-center border-b border-border/40 px-2 text-left text-[10px] font-medium text-muted-foreground hover:bg-muted/40"
                    style={{
                      top: lane.topPx,
                      height: LANE_HEIGHT,
                    }}
                  >
                    <span className="truncate">{lane.title}</span>
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
                      {editorSnapshot.audioSections.map((section, i) => {
                        const sectionDuration =
                          section.endTimeMillis - section.startTimeMillis;
                        const audioStart =
                          section.audio?.audioStartTimeMillies ?? 0n;
                        const audioEnd = audioStart + sectionDuration;
                        const sourceMs = sourceDurationMs(
                          section.audio?.meta?.duration,
                        );
                        const leftPx = msToPx(
                          section.startTimeMillis,
                          pxPerSecond,
                        );
                        const widthPx = msToPx(sectionDuration, pxPerSecond);
                        const topPx =
                          timelineLayout.lanes[
                            timelineLayout.audioSectionLaneIndices[i]
                          ]?.topPx ?? 0;
                        return (
                          <div
                            key={i}
                            data-slot="editor-timeline-audio-section"
                            data-audio-index={i}
                            data-selected={
                              editorSnapshot.selectedAudioSectionIndex === i
                            }
                            className={cn(
                              "group/audio-section absolute select-none overflow-hidden rounded-sm",
                              "bg-emerald-700 text-white",
                              editorSnapshot.selectedAudioSectionIndex === i &&
                                "ring-2 ring-primary",
                            )}
                            style={{
                              left: leftPx,
                              top: topPx,
                              width: widthPx,
                              height: LANE_HEIGHT,
                            }}
                            onPointerDown={(e) => {
                              if (e.button !== 0) return;
                              editorStore.selectAudioSection(i);
                            }}
                          >
                            <div
                              className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize bg-foreground/20 hover:bg-primary"
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                if (e.button !== 0) return;
                                const startClientX = e.clientX;
                                const initialAudioStart = audioStart;
                                const initialDuration = sectionDuration;
                                const maxAudioStart =
                                  initialAudioStart + initialDuration - 500n;
                                const onMove = (ev: PointerEvent) => {
                                  const deltaMs = snap(
                                    pxToMs(
                                      ev.clientX - startClientX,
                                      pxPerSecond,
                                    ),
                                  );
                                  let newAudioStart =
                                    initialAudioStart + deltaMs;
                                  if (newAudioStart < 0n) {
                                    newAudioStart = 0n;
                                  }
                                  if (newAudioStart > maxAudioStart) {
                                    newAudioStart = maxAudioStart;
                                  }
                                  const newDuration =
                                    initialDuration -
                                    (newAudioStart - initialAudioStart);
                                  editorStore.trimAudioStart(
                                    i,
                                    newDuration,
                                    newAudioStart,
                                  );
                                };
                                const onUp = () => {
                                  window.removeEventListener(
                                    "pointermove",
                                    onMove,
                                  );
                                  window.removeEventListener("pointerup", onUp);
                                  window.removeEventListener(
                                    "pointercancel",
                                    onUp,
                                  );
                                };
                                window.addEventListener("pointermove", onMove);
                                window.addEventListener("pointerup", onUp);
                                window.addEventListener("pointercancel", onUp);
                              }}
                            />
                            <div
                              className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize bg-foreground/20 hover:bg-primary"
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                if (e.button !== 0) return;
                                const startClientX = e.clientX;
                                const initialDuration = sectionDuration;
                                const maxDuration = sourceMs - audioStart;
                                const onMove = (ev: PointerEvent) => {
                                  const deltaMs = snap(
                                    pxToMs(
                                      ev.clientX - startClientX,
                                      pxPerSecond,
                                    ),
                                  );
                                  let newDuration = initialDuration + deltaMs;
                                  if (newDuration < 500n) {
                                    newDuration = 500n;
                                  }
                                  if (newDuration > maxDuration) {
                                    newDuration = maxDuration;
                                  }
                                  editorStore.trimAudioEnd(i, newDuration);
                                };
                                const onUp = () => {
                                  window.removeEventListener(
                                    "pointermove",
                                    onMove,
                                  );
                                  window.removeEventListener("pointerup", onUp);
                                  window.removeEventListener(
                                    "pointercancel",
                                    onUp,
                                  );
                                };
                                window.addEventListener("pointermove", onMove);
                                window.addEventListener("pointerup", onUp);
                                window.addEventListener("pointercancel", onUp);
                              }}
                            />
                            <button
                              type="button"
                              className="absolute right-2 top-1 z-10 flex size-4 items-center justify-center rounded-xs bg-background/80 text-muted-foreground opacity-0 ring-1 ring-foreground/10 group-hover/audio-section:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                editorStore.removeAudioSection(i);
                              }}
                              aria-label="Remove audio section"
                            >
                              ×
                            </button>
                            <div className="flex h-full flex-col justify-center gap-0.5 px-2 py-1 pr-8">
                              <span className="truncate text-[11px] font-medium leading-none">
                                {section.audio?.meta?.title ?? "Untitled"}
                              </span>
                              <span className="truncate text-[9px] leading-none text-white/75 tabular-nums">
                                {formatDuration(Number(audioStart))} -{" "}
                                {formatDuration(Number(audioEnd))}
                              </span>
                            </div>
                          </div>
                        );
                      })}
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
