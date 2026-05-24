import { useState } from "react";
import { editorStore, sourceDurationMs } from "../stores/editor";
import { msToPx, pxToMs } from "./geometry";
import { LANE_HEIGHT } from "./timelineConstants";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/utils/timestamp-conversaions";

interface AudioTimelineSection {
  readonly startTimeMillis: bigint;
  readonly endTimeMillis: bigint;
  readonly audio?: {
    readonly audioStartTimeMillies: bigint;
    readonly meta?: {
      readonly title?: string;
      readonly duration?: number;
    };
  };
}

interface AudioDragPreview {
  startClientX: number;
  currentClientX: number;
  initialStartMillis: bigint;
}

interface AudioTimelineSectionProps {
  section: AudioTimelineSection;
  index: number;
  isSelected: boolean;
  topPx: number;
  pxPerSecond: number;
  totalDuration: bigint;
}

export function AudioTimelineSection({
  section,
  index,
  isSelected,
  topPx,
  pxPerSecond,
  totalDuration,
}: AudioTimelineSectionProps) {
  const [dragPreview, setDragPreview] = useState<AudioDragPreview | null>(null);

  const sectionDuration = section.endTimeMillis - section.startTimeMillis;
  const audioStart = section.audio?.audioStartTimeMillies ?? 0n;
  const audioEnd = audioStart + sectionDuration;
  const sourceMs = sourceDurationMs(section.audio?.meta?.duration);
  let timelineStart = section.startTimeMillis;

  if (dragPreview !== null) {
    const deltaMs = pxToMs(
      dragPreview.currentClientX - dragPreview.startClientX,
      pxPerSecond,
    );
    const maxStart =
      totalDuration > sectionDuration ? totalDuration - sectionDuration : 0n;
    timelineStart = dragPreview.initialStartMillis + deltaMs;
    if (timelineStart < 0n) {
      timelineStart = 0n;
    }
    if (timelineStart > maxStart) {
      timelineStart = maxStart;
    }
  }

  const leftPx = msToPx(timelineStart, pxPerSecond);
  const widthPx = msToPx(sectionDuration, pxPerSecond);

  return (
    <div
      data-slot="editor-timeline-audio-section"
      data-audio-index={index}
      data-selected={isSelected}
      className={cn(
        "group/audio-section absolute select-none overflow-hidden rounded-sm",
        "bg-emerald-700 text-white",
        isSelected && "ring-2 ring-primary",
      )}
      style={{
        left: leftPx,
        top: topPx,
        width: widthPx,
        height: LANE_HEIGHT,
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        editorStore.selectAudioSection(index);
        const startClientX = e.clientX;
        const initialStart = section.startTimeMillis;
        let latestClientX = e.clientX;
        let didMove = false;
        const initialPreview = {
          startClientX,
          currentClientX: e.clientX,
          initialStartMillis: initialStart,
        };
        setDragPreview(initialPreview);
        const onMove = (ev: PointerEvent) => {
          latestClientX = ev.clientX;
          if (latestClientX === startClientX) return;
          didMove = true;
          setDragPreview({
            ...initialPreview,
            currentClientX: latestClientX,
          });
        };
        const onUp = () => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          window.removeEventListener("pointercancel", onUp);
          if (didMove) {
            const deltaMs = pxToMs(latestClientX - startClientX, pxPerSecond);
            editorStore.moveAudioSection(index, initialStart + deltaMs);
          }
          setDragPreview(null);
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);
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
          const maxAudioStart = initialAudioStart + initialDuration - 500n;
          const onMove = (ev: PointerEvent) => {
            const deltaMs = pxToMs(ev.clientX - startClientX, pxPerSecond);
            let newAudioStart = initialAudioStart + deltaMs;
            if (newAudioStart < 0n) {
              newAudioStart = 0n;
            }
            if (newAudioStart > maxAudioStart) {
              newAudioStart = maxAudioStart;
            }
            const newDuration =
              initialDuration - (newAudioStart - initialAudioStart);
            editorStore.trimAudioStart(index, newDuration, newAudioStart);
          };
          const onUp = () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointercancel", onUp);
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
            const deltaMs = pxToMs(ev.clientX - startClientX, pxPerSecond);
            let newDuration = initialDuration + deltaMs;
            if (newDuration < 500n) {
              newDuration = 500n;
            }
            if (newDuration > maxDuration) {
              newDuration = maxDuration;
            }
            editorStore.trimAudioEnd(index, newDuration);
          };
          const onUp = () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointercancel", onUp);
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
          editorStore.removeAudioSection(index);
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
}
