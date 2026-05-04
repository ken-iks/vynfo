import type { RefObject } from "react";
import { useCallback, useState } from "react";
import { editorStore } from "../../stores/editor";
import { videoRuntime } from "../../stores/videoRuntime";
import { pxToMs } from "../geometry";

interface UseTimelineSeekingArgs {
  naturalTrackWidth: number;
  pxPerSecond: number;
  totalDuration: bigint;
  viewportRef: RefObject<HTMLDivElement | null>;
}

export function useTimelineSeeking({
  naturalTrackWidth,
  pxPerSecond,
  totalDuration,
  viewportRef,
}: UseTimelineSeekingArgs) {
  const [hoverTrackPx, setHoverTrackPx] = useState<number | null>(null);

  const clientXToTrackPx = useCallback(
    (clientX: number): number => {
      const viewport = viewportRef.current;
      if (!viewport) return 0;
      const rect = viewport.getBoundingClientRect();
      return clientX - rect.left + viewport.scrollLeft;
    },
    [viewportRef],
  );

  const clampTrackPx = useCallback(
    (trackPx: number): number => {
      return Math.min(Math.max(trackPx, 0), naturalTrackWidth);
    },
    [naturalTrackWidth],
  );

  const seekToTrackPx = useCallback(
    (trackPx: number) => {
      if (totalDuration <= 0n) return;

      const clampedPx = clampTrackPx(trackPx);
      let nextTime = pxToMs(clampedPx, pxPerSecond);
      if (nextTime > totalDuration) nextTime = totalDuration;
      editorStore.setPlaybackTimeMillis(nextTime);
      videoRuntime.seekToMillis(nextTime);
    },
    [clampTrackPx, pxPerSecond, totalDuration],
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

  const updateHoverTrackPx = useCallback(
    (clientX: number) => {
      setHoverTrackPx(clampTrackPx(clientXToTrackPx(clientX)));
    },
    [clampTrackPx, clientXToTrackPx],
  );

  return {
    beginTimelineSeek,
    clampTrackPx,
    clientXToTrackPx,
    hoverTrackPx,
    setHoverTrackPx,
    updateHoverTrackPx,
  };
}
