import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSnapshot } from "valtio";
import type { MediaVideoMetadata } from "@/gen/proto/v1/projects_pb";
import { editorStore } from "../../stores/editor";
import { TimelineSection } from "./TimelineSection";
import { TimelineRuler } from "./TimelineRuler";
import {
  TimelineContextMenu,
  type TimelineMenuContext,
} from "./TimelineContextMenu";
import { useTimelineReorder } from "./useTimelineReorder";
import { DEFAULT_PX_PER_SECOND, MAX_PX_PER_SECOND, msToPx } from "./geometry";
import { ContextMenu, ContextMenuTrigger } from "../../ui/context-menu";
import { cn } from "@/lib/utils";

interface TimelineTrackProps {
  availableVideos: MediaVideoMetadata[];
}

const TIMELINE_HEIGHT = 72;
const RULER_HEIGHT = 22;

export function TimelineTrack({ availableVideos }: TimelineTrackProps) {
  const snap = useSnapshot(editorStore);
  const totalDuration = snap.totalDurationMillis;

  const trackRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = trackRef.current;
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
    if (fit > MAX_PX_PER_SECOND) return MAX_PX_PER_SECOND;
    return fit;
  }, [totalDuration, containerWidth]);

  const trackWidth = containerWidth || 0;

  const clientXToTrackPx = useCallback((clientX: number): number => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    return clientX - rect.left;
  }, []);

  const { reorder, handleBeginReorder, previewLefts } = useTimelineReorder({
    sections: snap.sections,
    pxPerSecond,
    clientXToTrackPx,
  });

  const playheadLeft = msToPx(snap.playbackTimeMillis, pxPerSecond);

  const [menuContext, setMenuContext] = useState<TimelineMenuContext | null>(
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
    <ContextMenu
      onOpenChange={(open) => {
        if (!open) setMenuContext(null);
      }}
    >
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "relative flex-1 overflow-hidden rounded-none",
            "border border-border bg-muted/10",
          )}
          onContextMenu={handleTrackContextMenu}
        >
          <div
            ref={trackRef}
            className="relative h-full w-full"
            style={{ minHeight: TIMELINE_HEIGHT + RULER_HEIGHT }}
          >
            <TimelineRuler
              totalDurationMillis={totalDuration}
              pxPerSecond={pxPerSecond}
              height={RULER_HEIGHT}
            />
            <div
              className="relative"
              style={{ height: TIMELINE_HEIGHT, width: trackWidth }}
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) {
                  editorStore.selectSection(null);
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
                      className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-primary"
                      style={{
                        left: Math.min(Math.max(playheadLeft, 0), trackWidth),
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
      />
    </ContextMenu>
  );
}
