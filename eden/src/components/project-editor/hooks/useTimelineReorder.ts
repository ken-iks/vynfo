import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { editorStore } from "../../stores/editor";
import { msToPx } from "../geometry";

export interface ReorderState {
  fromIndex: number;
  startClientX: number;
  currentClientX: number;
  grabOffsetInSectionPx: number;
  sectionWidthPx: number;
  targetIndex: number;
}

interface SectionLike {
  startTimeMillis: bigint;
  endTimeMillis: bigint;
}

interface UseTimelineReorderArgs {
  sections: readonly SectionLike[];
  pxPerSecond: number;
  clientXToTrackPx: (clientX: number) => number;
}

export function useTimelineReorder({
  sections,
  pxPerSecond,
  clientXToTrackPx,
}: UseTimelineReorderArgs) {
  const [reorder, setReorder] = useState<ReorderState | null>(null);
  // React 19 Strict Mode invokes functional setState updaters twice to catch
  // impure updates, so we must never mutate the valtio store from inside
  // `setReorder(prev => ...)`. The ref mirrors the latest reorder state so the
  // pointerup handler can read it and commit `editorStore.reorder` exactly once.
  const reorderRef = useRef<ReorderState | null>(null);
  useEffect(() => {
    reorderRef.current = reorder;
  }, [reorder]);

  const computeReorderTarget = useCallback(
    (
      fromIndex: number,
      currentClientX: number,
      grabOffsetInSectionPx: number,
      sectionWidthPx: number,
    ): number => {
      const currentSectionLeftTrackPx =
        clientXToTrackPx(currentClientX) - grabOffsetInSectionPx;
      const currentSectionRightTrackPx =
        currentSectionLeftTrackPx + sectionWidthPx;
      let count = 0;
      for (let i = 0; i < sections.length; i++) {
        if (i === fromIndex) continue;
        const s = sections[i];
        const otherLeft = msToPx(s.startTimeMillis, pxPerSecond);
        const otherWidth = msToPx(
          s.endTimeMillis - s.startTimeMillis,
          pxPerSecond,
        );
        const otherCenter = otherLeft + otherWidth / 2;
        if (i < fromIndex) {
          if (currentSectionLeftTrackPx >= otherCenter) count++;
        } else {
          if (currentSectionRightTrackPx > otherCenter) count++;
        }
      }
      return count < fromIndex ? count : count + 1;
    },
    [sections, pxPerSecond, clientXToTrackPx],
  );

  const handleBeginReorder = useCallback(
    (index: number, clientX: number) => {
      const section = editorStore.sections[index];
      if (!section) return;
      const sectionLeftTrackPx =
        (Number(section.startTimeMillis) * pxPerSecond) / 1000;
      const sectionWidthPx =
        (Number(section.endTimeMillis - section.startTimeMillis) *
          pxPerSecond) /
        1000;
      const startTrackPx = clientXToTrackPx(clientX);
      const grabOffsetInSectionPx = startTrackPx - sectionLeftTrackPx;
      setReorder({
        fromIndex: index,
        startClientX: clientX,
        currentClientX: clientX,
        grabOffsetInSectionPx,
        sectionWidthPx,
        targetIndex: index,
      });
    },
    [clientXToTrackPx, pxPerSecond],
  );

  useEffect(() => {
    if (!reorder) return;
    const onMove = (ev: PointerEvent) => {
      setReorder((prev) => {
        if (!prev) return prev;
        const target = computeReorderTarget(
          prev.fromIndex,
          ev.clientX,
          prev.grabOffsetInSectionPx,
          prev.sectionWidthPx,
        );
        return { ...prev, currentClientX: ev.clientX, targetIndex: target };
      });
    };
    const onUp = () => {
      const current = reorderRef.current;
      if (current && current.targetIndex !== current.fromIndex) {
        editorStore.reorder(current.fromIndex, current.targetIndex);
      }
      setReorder(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [reorder, computeReorderTarget]);

  const previewLefts = useMemo<number[] | null>(() => {
    if (!reorder) return null;
    const { fromIndex, targetIndex } = reorder;
    if (targetIndex === fromIndex) return null;
    const orderIndices: number[] = [];
    for (let i = 0; i < sections.length; i++) {
      if (i !== fromIndex) orderIndices.push(i);
    }
    const adjusted = targetIndex > fromIndex ? targetIndex - 1 : targetIndex;
    orderIndices.splice(adjusted, 0, fromIndex);

    const lefts = new Array<number>(sections.length);
    let running = 0;
    for (const origIdx of orderIndices) {
      lefts[origIdx] = running;
      const s = sections[origIdx];
      running += msToPx(s.endTimeMillis - s.startTimeMillis, pxPerSecond);
    }
    return lefts;
  }, [reorder, sections, pxPerSecond]);

  return { reorder, handleBeginReorder, previewLefts };
}
