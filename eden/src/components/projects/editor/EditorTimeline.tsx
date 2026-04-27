import { useSnapshot } from "valtio";
import type {
  MediaImageMetadata,
  MediaTextMetadata,
  MediaVideoMetadata,
} from "@/gen/proto/v1/projects_pb";
import { editorStore } from "../../stores/editor";
import { CommitDialog } from "./CommitDialog";
import { TimelineTrack } from "./TimelineTrack";
import { formatDuration } from "@/lib/utils";

interface EditorTimelineProps {
  projectId: string;
  branchName: string;
  tipCommitId: string | undefined;
  availableVideos: MediaVideoMetadata[];
  availableImages: MediaImageMetadata[];
  availableTexts: MediaTextMetadata[];
  onCommitSuccess: (newCommitId: string) => void;
}

export function EditorTimeline({
  projectId,
  branchName,
  tipCommitId,
  availableVideos,
  availableImages,
  availableTexts,
  onCommitSuccess,
}: EditorTimelineProps) {
  const snap = useSnapshot(editorStore);
  const totalDuration = snap.totalDurationMillis;

  return (
    <div className="flex h-full flex-col gap-2">
      <TimelineTrack
        availableVideos={availableVideos}
        availableImages={availableImages}
        availableTexts={availableTexts}
      />
      <div className="flex items-center justify-between px-2 py-1">
        <CommitDialog
          projectId={projectId}
          branchName={branchName}
          tipCommitId={tipCommitId}
          disabled={snap.sections.length === 0}
          onCommitSuccess={onCommitSuccess}
        />
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {formatDuration(Number(totalDuration))}
        </span>
      </div>
    </div>
  );
}
