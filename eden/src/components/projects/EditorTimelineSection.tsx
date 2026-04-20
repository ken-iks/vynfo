import type { PlaybackSection } from "@/gen/proto/v1/api_pb";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Snapshot } from "valtio";
import {
  MIN_DURATION_MS,
  editorStore,
  snap,
  sourceDurationMs,
} from "../stores/editor";
import { cn, formatDuration } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { pxToMs, videoColors } from "./timelineGeometry";

interface EditorTimelineSectionProps {
  section: Snapshot<PlaybackSection>;
  index: number;
  isSelected: boolean;
  leftPx: number;
  widthPx: number;
  pxPerSecond: number;
  isBeingDragged: boolean;
  isAnyDragActive: boolean;
  dragOffsetPx: number;
  onBeginReorder: (index: number, clientX: number) => void;
}

export function EditorTimelineSection({
  section,
  index,
  isSelected,
  leftPx,
  widthPx,
  pxPerSecond,
  isBeingDragged,
  isAnyDragActive,
  dragOffsetPx,
  onBeginReorder,
}: EditorTimelineSectionProps) {
  const duration = section.endTimeMillis - section.startTimeMillis;
  const videoStart = section.video?.videoStartTimeMillies ?? 0n;
  const videoEnd = videoStart + duration;
  const colors = videoColors(section.video?.meta?.assetId);

  const handleLeftPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const sourceMs = sourceDurationMs(section.video?.meta?.duration);
    const startClientX = e.clientX;
    const initialVideoStart = section.video?.videoStartTimeMillies ?? 0n;
    const initialDuration = duration;
    const minVideoStart = 0n;
    const maxVideoStart = initialVideoStart + initialDuration - MIN_DURATION_MS;

    const onMove = (ev: PointerEvent) => {
      const deltaMs = snap(pxToMs(ev.clientX - startClientX, pxPerSecond));
      let newVideoStart = initialVideoStart + deltaMs;
      if (newVideoStart < minVideoStart) newVideoStart = minVideoStart;
      if (newVideoStart > maxVideoStart) newVideoStart = maxVideoStart;
      const newDuration = initialDuration - (newVideoStart - initialVideoStart);
      if (newDuration < MIN_DURATION_MS) return;
      if (newVideoStart + newDuration > sourceMs) return;
      editorStore.trimStart(index, newDuration, newVideoStart);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const handleRightPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const sourceMs = sourceDurationMs(section.video?.meta?.duration);
    const startClientX = e.clientX;
    const initialDuration = duration;
    const initialVideoStart = section.video?.videoStartTimeMillies ?? 0n;
    const maxDuration = sourceMs - initialVideoStart;

    const onMove = (ev: PointerEvent) => {
      const deltaMs = snap(pxToMs(ev.clientX - startClientX, pxPerSecond));
      let newDuration = initialDuration + deltaMs;
      if (newDuration < MIN_DURATION_MS) newDuration = MIN_DURATION_MS;
      if (newDuration > maxDuration) newDuration = maxDuration;
      editorStore.trimEnd(index, newDuration);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const handleBodyPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    editorStore.selectSection(index);
    onBeginReorder(index, e.clientX);
  };

  return (
    <div
      data-slot="editor-timeline-section"
      data-index={index}
      data-selected={isSelected}
      data-dragging={isBeingDragged}
      className={cn(
        "group/section absolute top-0 bottom-0 select-none overflow-hidden",
        "text-white",
        isAnyDragActive &&
          !isBeingDragged &&
          "transition-[left] duration-150 ease-out",
        isSelected && "ring-2 ring-primary",
        isBeingDragged && "z-20 shadow-lg ring-2 ring-primary",
      )}
      style={{
        left: leftPx,
        width: widthPx,
        transform: isBeingDragged ? `translateX(${dragOffsetPx}px)` : undefined,
        backgroundColor: colors.background,
        boxShadow:
          isSelected || isBeingDragged ? undefined : `inset 0 0 0 1px ${colors.ring}`,
      }}
      onPointerDown={handleBodyPointerDown}
    >
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-1.5 cursor-ew-resize",
          "bg-foreground/20 hover:bg-primary",
        )}
        onPointerDown={handleLeftPointerDown}
      />
      <div
        className={cn(
          "absolute inset-y-0 right-0 w-1.5 cursor-ew-resize",
          "bg-foreground/20 hover:bg-primary",
        )}
        onPointerDown={handleRightPointerDown}
      />
      <button
        type="button"
        className={cn(
          "absolute right-2 top-1 z-10 flex size-4 items-center justify-center rounded-xs",
          "bg-background/80 text-muted-foreground opacity-0 ring-1 ring-foreground/10",
          "group-hover/section:opacity-100 hover:bg-destructive hover:text-destructive-foreground",
        )}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          editorStore.removeSection(index);
        }}
        aria-label="Remove section"
      >
        <HugeiconsIcon icon={Cancel01Icon} size={10} strokeWidth={2} />
      </button>
      <div className="flex h-full cursor-grab flex-col justify-between px-3 py-2 active:cursor-grabbing">
        <span className="truncate text-xs font-medium">
          {section.video?.meta?.title ?? "Untitled"}
        </span>
        <span className="text-[10px] text-white/75 tabular-nums">
          {formatDuration(Number(videoStart))} -{" "}
          {formatDuration(Number(videoEnd))}
        </span>
      </div>
    </div>
  );
}
