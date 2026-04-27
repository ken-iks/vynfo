import {
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
} from "@heroicons/react/24/outline";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSnapshot } from "valtio";
import type { MediaVideoMetadata } from "@/gen/proto/v1/projects_pb";
import { editorStore } from "../../stores/editor";
import { videoRuntime } from "../../stores/videoRuntime";
import { TimelineSection } from "./TimelineSection";
import { TimelineRuler } from "./TimelineRuler";
import {
  TimelineContextMenu,
  type TimelineMenuContext,
} from "./TimelineContextMenu";
import { EffectsComposer } from "./EffectsComposer";
import { useTimelineReorder } from "./useTimelineReorder";
import {
  DEFAULT_PX_PER_SECOND,
  MAX_PX_PER_SECOND,
  msToPx,
  pxToMs,
} from "./geometry";
import { ContextMenu, ContextMenuTrigger } from "../../ui/context-menu";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface TimelineTrackProps {
  availableVideos: MediaVideoMetadata[];
}

interface TimelineLane {
  key: string;
  title: string;
  video: MediaVideoMetadata | undefined;
  topPx: number;
}

const EMPTY_TIMELINE_HEIGHT = 72;
const LANE_HEIGHT = 34;
const LANE_GAP = 3;
const LABEL_WIDTH = 160;
const RULER_HEIGHT = 22;
const MAX_ZOOM_LEVEL = 4;

export function TimelineTrack({ availableVideos }: TimelineTrackProps) {
  const snap = useSnapshot(editorStore);
  const totalDuration = snap.totalDurationMillis;

  const viewportRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(0);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pxPerSecond = useMemo(() => {
    const totalMs = Number(totalDuration);
    if (totalMs <= 0 || containerWidth <= 0) return DEFAULT_PX_PER_SECOND;
    const fit = (containerWidth * 1000) / totalMs;
    const fitPxPerSecond = fit > MAX_PX_PER_SECOND ? MAX_PX_PER_SECOND : fit;
    if (zoomLevel === 0) return fitPxPerSecond;
    return Math.min(MAX_PX_PER_SECOND, fitPxPerSecond * (zoomLevel + 1));
  }, [totalDuration, containerWidth, zoomLevel]);

  const naturalTrackWidth = msToPx(totalDuration, pxPerSecond);
  const trackWidth = Math.max(containerWidth || 0, naturalTrackWidth);
  const timelineLayout = useMemo(() => {
    const lanes: TimelineLane[] = [];
    const sectionLaneIndices: number[] = [];
    const laneIndicesByKey = new Map<string, number>();

    const addLane = (
      key: string,
      title: string,
      video: MediaVideoMetadata | undefined,
    ): number => {
      const existingLaneIndex = laneIndicesByKey.get(key);
      if (existingLaneIndex !== undefined) return existingLaneIndex;
      const laneIndex = lanes.length;
      laneIndicesByKey.set(key, laneIndex);
      lanes.push({
        key,
        title,
        video,
        topPx: laneIndex * (LANE_HEIGHT + LANE_GAP),
      });
      return laneIndex;
    };

    for (const video of availableVideos) {
      if (!video.assetId) continue;
      addLane(video.assetId, video.title || "Untitled", video);
    }

    for (let i = 0; i < editorStore.sections.length; i++) {
      const section = editorStore.sections[i];
      const key = section.video?.meta?.assetId ?? `section-${i}`;
      sectionLaneIndices[i] = addLane(
        key,
        section.video?.meta?.title ?? "Untitled",
        section.video?.meta,
      );
    }

    const totalLaneHeight =
      lanes.length === 0
        ? EMPTY_TIMELINE_HEIGHT
        : lanes.length * LANE_HEIGHT + (lanes.length - 1) * LANE_GAP;

    return { lanes, sectionLaneIndices, totalLaneHeight };
  }, [availableVideos, snap.sections]);
  const timelineHeight = timelineLayout.totalLaneHeight;

  const clientXToTrackPx = useCallback((clientX: number): number => {
    const viewport = viewportRef.current;
    if (!viewport) return 0;
    const rect = viewport.getBoundingClientRect();
    return clientX - rect.left + viewport.scrollLeft;
  }, []);

  const seekToTrackPx = useCallback(
    (trackPx: number) => {
      if (totalDuration <= 0n) return;

      const clampedPx = Math.min(Math.max(trackPx, 0), naturalTrackWidth);
      let nextTime = pxToMs(clampedPx, pxPerSecond);
      if (nextTime > totalDuration) nextTime = totalDuration;
      editorStore.setPlaybackTimeMillis(nextTime);
      videoRuntime.seekToMillis(nextTime);
    },
    [naturalTrackWidth, pxPerSecond, totalDuration],
  );

  const beginTimelineSeek = useCallback(
    (clientX: number) => {
      seekToTrackPx(clientXToTrackPx(clientX));

      const onMove = (ev: PointerEvent) => {
        seekToTrackPx(clientXToTrackPx(ev.clientX));
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [clientXToTrackPx, seekToTrackPx],
  );

  const { reorder, handleBeginReorder, previewLefts } = useTimelineReorder({
    sections: snap.sections,
    pxPerSecond,
    clientXToTrackPx,
  });

  const playheadLeft = msToPx(snap.playbackTimeMillis, pxPerSecond);

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

  const [menuContext, setMenuContext] = useState<TimelineMenuContext | null>(
    null,
  );
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
        }
      } else if (ev.key === "Escape") {
        editorStore.selectSection(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleTrackContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    const trackPx = clientXToTrackPx(e.clientX);
    const target = e.target;
    let sectionIndex: number | null = null;
    if (target instanceof HTMLElement) {
      const el = target.closest<HTMLElement>(
        "[data-slot=editor-timeline-section]",
      );
      if (el && el.dataset.index !== undefined) {
        sectionIndex = Number(el.dataset.index);
      }
    }
    setMenuContext({ trackPx, sectionIndex });
  };

  const computeInsertIndex = useCallback(
    (trackPx: number): number => {
      const sections = snap.sections;
      for (let i = 0; i < sections.length; i++) {
        const s = sections[i];
        const left = msToPx(s.startTimeMillis, pxPerSecond);
        const width = msToPx(s.endTimeMillis - s.startTimeMillis, pxPerSecond);
        if (trackPx < left + width / 2) return i;
      }
      return sections.length;
    },
    [snap.sections, pxPerSecond],
  );

  const insertVideoFromLane = useCallback(
    (video: MediaVideoMetadata | undefined, clientX: number) => {
      if (!video) return;
      const insertIndex = computeInsertIndex(clientXToTrackPx(clientX));
      editorStore.insertVideoAt(insertIndex, video);
    },
    [clientXToTrackPx, computeInsertIndex],
  );

  return (
    <div className="flex flex-1 flex-col gap-2">
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
          <div className="flex flex-1 overflow-x-hidden overflow-y-auto rounded-none border border-border bg-muted/10">
            <div
              className="shrink-0 border-r border-border bg-background/40"
              style={{
                width: LABEL_WIDTH,
                minHeight: timelineHeight + RULER_HEIGHT,
              }}
            >
              <div className="h-[22px] border-b border-border/60" />
              <div className="relative" style={{ height: timelineHeight }}>
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
              className="relative flex-1 overflow-x-auto overflow-y-hidden"
              onContextMenu={handleTrackContextMenu}
              ref={viewportRef}
            >
              <div
                className="relative h-full w-full"
                style={{
                  minHeight: timelineHeight + RULER_HEIGHT,
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
                      {timelineLayout.lanes.map((lane) => (
                        <button
                          key={lane.key}
                          type="button"
                          className="absolute inset-x-0 rounded-sm border border-border/60 bg-background/30 text-left hover:bg-muted/30"
                          style={{
                            top: lane.topPx,
                            height: LANE_HEIGHT,
                          }}
                          onPointerDown={(e) => {
                            if (e.button !== 0) return;
                            e.preventDefault();
                            e.stopPropagation();
                            insertVideoFromLane(lane.video, e.clientX);
                          }}
                        >
                          <span className="sr-only">Add {lane.title}</span>
                        </button>
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
                              snap.sections[reorder.fromIndex].startTimeMillis,
                              pxPerSecond,
                            ),
                            width: msToPx(
                              snap.sections[reorder.fromIndex].endTimeMillis -
                                snap.sections[reorder.fromIndex]
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
                      {snap.sections.map((section, i) => {
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
                            isSelected={snap.selectedSectionIndex === i}
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
              </div>
            </div>
          </div>
        </ContextMenuTrigger>
        <TimelineContextMenu
          menuContext={menuContext}
          availableVideos={availableVideos}
          computeInsertIndex={computeInsertIndex}
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
