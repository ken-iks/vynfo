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

const TIMELINE_HEIGHT = 72;
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
          <div
            className={cn(
              "relative flex-1 overflow-x-auto overflow-y-hidden rounded-none",
              "border border-border bg-muted/10",
            )}
            onContextMenu={handleTrackContextMenu}
            ref={viewportRef}
          >
            <div
              className="relative h-full w-full"
              style={{
                minHeight: TIMELINE_HEIGHT + RULER_HEIGHT,
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
                style={{ height: TIMELINE_HEIGHT, width: trackWidth }}
                onPointerDown={(e) => {
                  if (e.target === e.currentTarget) {
                    editorStore.selectSection(null);
                    beginTimelineSeek(e.clientX);
                  }
                }}
              >
                {snap.sections.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    Right-click to add a video, or drop one in from the assets
                    list
                  </div>
                ) : (
                  <>
                    {reorder && (
                      <div
                        className={cn(
                          "pointer-events-none absolute top-0 bottom-0",
                          "rounded-none bg-card/50 backdrop-blur-sm",
                          "ring-1 ring-dashed ring-primary/60",
                        )}
                        style={{
                          left: msToPx(
                            snap.sections[reorder.fromIndex].startTimeMillis,
                            pxPerSecond,
                          ),
                          width: msToPx(
                            snap.sections[reorder.fromIndex].endTimeMillis -
                              snap.sections[reorder.fromIndex].startTimeMillis,
                            pxPerSecond,
                          ),
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
                      const dragOffsetPx =
                        isBeingDragged && reorder
                          ? reorder.currentClientX - reorder.startClientX
                          : 0;
                      const leftPx = isBeingDragged ? naturalLeft : previewLeft;
                      return (
                        <TimelineSection
                          key={i}
                          section={section}
                          index={i}
                          isSelected={snap.selectedSectionIndex === i}
                          leftPx={leftPx}
                          widthPx={widthPx}
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
                          left: Math.min(Math.max(playheadLeft, 0), trackWidth),
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
