import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_PX_PER_SECOND, MAX_PX_PER_SECOND, msToPx } from "../geometry";

export function useTimelineZoom(totalDuration: bigint) {
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

  return {
    containerWidth,
    naturalTrackWidth,
    pxPerSecond,
    setZoomLevel,
    trackWidth,
    viewportRef,
    zoomLevel,
  };
}
