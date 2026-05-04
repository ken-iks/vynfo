import { useSnapshot } from "valtio";
import type {
  MediaAudioMetadata,
  MediaImageMetadata,
  MediaVideoMetadata,
} from "@/gen/proto/v1/projects_pb";
import { editorStore } from "../../stores/editor";
import { TimelineTrack } from "./TimelineTrack";
import { formatDuration } from "@/lib/utils";

interface EditorTimelineProps {
  availableVideos: MediaVideoMetadata[];
  availableAudios: MediaAudioMetadata[];
  availableImages: MediaImageMetadata[];
}

export function EditorTimeline({
  availableVideos,
  availableAudios,
  availableImages,
}: EditorTimelineProps) {
  const snap = useSnapshot(editorStore);
  const totalDuration = snap.totalDurationMillis;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <TimelineTrack
        availableVideos={availableVideos}
        availableAudios={availableAudios}
        availableImages={availableImages}
      />
      <div className="flex items-center justify-end px-2 py-1">
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {formatDuration(Number(totalDuration))}
        </span>
      </div>
    </div>
  );
}
