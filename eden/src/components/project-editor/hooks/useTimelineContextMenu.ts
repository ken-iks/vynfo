import type { MouseEvent } from "react";
import { useState } from "react";
import type { TimelineMenuContext } from "../TimelineContextMenu";

interface UseTimelineContextMenuArgs {
  clientXToTrackPx: (clientX: number) => number;
}

export function useTimelineContextMenu({
  clientXToTrackPx,
}: UseTimelineContextMenuArgs) {
  const [menuContext, setMenuContext] = useState<TimelineMenuContext | null>(
    null,
  );

  const handleTrackContextMenu = (e: MouseEvent<HTMLDivElement>) => {
    const trackPx = clientXToTrackPx(e.clientX);
    const target = e.target;
    let sectionIndex: number | null = null;
    let audioSectionIndex: number | null = null;
    if (target instanceof HTMLElement) {
      const sectionEl = target.closest<HTMLElement>(
        "[data-slot=editor-timeline-section]",
      );
      if (sectionEl && sectionEl.dataset.index !== undefined) {
        sectionIndex = Number(sectionEl.dataset.index);
      }
      const audioSectionEl = target.closest<HTMLElement>(
        "[data-slot=editor-timeline-audio-section]",
      );
      if (audioSectionEl && audioSectionEl.dataset.audioIndex !== undefined) {
        audioSectionIndex = Number(audioSectionEl.dataset.audioIndex);
      }
    }
    setMenuContext({ audioSectionIndex, trackPx, sectionIndex });
  };

  return {
    handleTrackContextMenu,
    menuContext,
    setMenuContext,
  };
}
