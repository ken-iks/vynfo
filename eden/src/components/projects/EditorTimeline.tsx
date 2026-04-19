import { useSnapshot } from "valtio";
import { editorStore } from "../stores/editor";
import { EditorTimelineSection } from "./EditorTimelineSection";
import { formatDuration } from "@/lib/utils";

export function EditorTimeline() {
  const snap = useSnapshot(editorStore);
  const totalDuration = snap.totalDurationMillis;

  if (snap.sections.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Add a video to get started
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-1 gap-1">
        {snap.sections.map((section, i) => {
          const sectionDuration =
            section.endTimeMillis - section.startTimeMillis;
          const widthPercent =
            totalDuration > 0n
              ? Number((sectionDuration * 10000n) / totalDuration) / 100
              : 0;

          return (
            <EditorTimelineSection
              key={i}
              section={section}
              index={i}
              isSelected={snap.selectedSectionIndex === i}
              widthPercent={widthPercent}
            />
          );
        })}
      </div>
      <div className="flex justify-end px-2 py-1">
        <span className="text-xs text-muted-foreground">
          {formatDuration(Number(totalDuration))}
        </span>
      </div>
    </div>
  );
}
