import type { MediaVideoMetadata } from "@/gen/proto/v1/projects_pb";
import { editorStore } from "../../stores/editor";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "../../ui/context-menu";

export interface TimelineMenuContext {
  trackPx: number;
  sectionIndex: number | null;
}

interface TimelineContextMenuProps {
  menuContext: TimelineMenuContext | null;
  availableVideos: MediaVideoMetadata[];
  computeInsertIndex: (trackPx: number) => number;
}

export function TimelineContextMenu({
  menuContext,
  availableVideos,
  computeInsertIndex,
}: TimelineContextMenuProps) {
  return (
    <ContextMenuContent>
      {menuContext?.sectionIndex !== null &&
        menuContext?.sectionIndex !== undefined && (
          <>
            <ContextMenuItem
              onSelect={() => {
                if (menuContext.sectionIndex !== null) {
                  editorStore.removeSection(menuContext.sectionIndex);
                }
              }}
              variant="destructive"
            >
              Delete section
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
      <ContextMenuSub>
        <ContextMenuSubTrigger disabled={availableVideos.length === 0}>
          Insert video here
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="max-h-64 overflow-y-auto">
          {availableVideos.length === 0 ? (
            <ContextMenuItem disabled>No videos uploaded</ContextMenuItem>
          ) : (
            availableVideos.map((video) => (
              <ContextMenuItem
                key={video.assetId}
                onSelect={() => {
                  if (menuContext === null) return;
                  const insertIndex = computeInsertIndex(menuContext.trackPx);
                  editorStore.insertVideoAt(insertIndex, video);
                }}
              >
                {video.title || video.assetId}
              </ContextMenuItem>
            ))
          )}
        </ContextMenuSubContent>
      </ContextMenuSub>
    </ContextMenuContent>
  );
}
