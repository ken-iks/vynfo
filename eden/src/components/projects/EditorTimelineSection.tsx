import type { PlaybackSection } from "@/gen/proto/v1/api_pb";
import type { Snapshot } from "valtio";
import { editorStore } from "../stores/editor";
import { Card, CardContent } from "../ui/card";
import { formatDuration } from "@/lib/utils";

interface EditorTimelineSectionProps {
  section: Snapshot<PlaybackSection>;
  index: number;
  isSelected: boolean;
  widthPercent: number;
}

export function EditorTimelineSection({
  section,
  index,
  isSelected,
  widthPercent,
}: EditorTimelineSectionProps) {
  const duration = section.endTimeMillis - section.startTimeMillis;

  return (
    <Card
      className={`min-w-[60px] cursor-pointer truncate transition-colors ${
        isSelected ? "ring-2 ring-primary" : ""
      }`}
      style={{ width: `${widthPercent}%` }}
      onClick={() => editorStore.selectSection(index)}
    >
      <CardContent className="flex flex-col justify-between h-full p-2">
        <span className="text-xs font-medium truncate">
          {section.video?.meta?.title ?? "Untitled"}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {formatDuration(Number(duration))}
        </span>
      </CardContent>
    </Card>
  );
}
