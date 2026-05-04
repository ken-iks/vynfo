import { snap, SNAP_MS } from "../stores/editor";

export const MIN_PX_PER_SECOND = 20;
export const MAX_PX_PER_SECOND = 400;
export const DEFAULT_PX_PER_SECOND = 100;

export function msToPx(ms: bigint, pxPerSecond: number): number {
  return (Number(ms) * pxPerSecond) / 1000;
}

export function pxToMs(px: number, pxPerSecond: number): bigint {
  if (pxPerSecond <= 0) return 0n;
  return BigInt(Math.round((px * 1000) / pxPerSecond));
}

export function snapPxToMs(px: number, pxPerSecond: number): bigint {
  return snap(pxToMs(px, pxPerSecond));
}

export function snapMsPx(pxPerSecond: number): number {
  return (Number(SNAP_MS) * pxPerSecond) / 1000;
}

export function videoColorHue(assetId: string | undefined): number {
  if (!assetId) return 220;
  let hash = 0;
  for (let i = 0; i < assetId.length; i++) {
    hash = (hash * 31 + assetId.charCodeAt(i)) | 0;
  }
  return ((hash % 360) + 360) % 360;
}

export function videoColors(assetId: string | undefined): {
  background: string;
  ring: string;
} {
  const hue = videoColorHue(assetId);
  return {
    background: `hsl(${hue} 45% 38%)`,
    ring: `hsl(${hue} 55% 55%)`,
  };
}
