import type {
  MediaImageMetadata,
  MediaTextMetadata,
  MediaVideoMetadata,
} from "@/gen/proto/v1/projects_pb";
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
  availableImages: MediaImageMetadata[];
  availableTexts: MediaTextMetadata[];
  computeInsertIndex: (trackPx: number) => number;
  onEditEffects: (sectionIndex: number) => void;
}

export function TimelineContextMenu({
  menuContext,
  availableVideos,
  availableImages,
  availableTexts,
  computeInsertIndex,
  onEditEffects,
}: TimelineContextMenuProps) {
  const sectionIndex = menuContext?.sectionIndex ?? null;

  return (
    <ContextMenuContent>
      {sectionIndex !== null && (
        <>
          <ContextMenuSub>
            <ContextMenuSubTrigger disabled={availableImages.length === 0}>
              Add image
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="max-h-64 overflow-y-auto">
              {availableImages.length === 0 ? (
                <ContextMenuItem disabled>No images uploaded</ContextMenuItem>
              ) : (
                availableImages.map((image) => (
                  <ContextMenuItem
                    key={image.assetId}
                    onSelect={() => {
                      editorStore.addImageOverlay(image, sectionIndex);
                    }}
                  >
                    {image.title || image.assetId}
                  </ContextMenuItem>
                ))
              )}
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSub>
            <ContextMenuSubTrigger disabled={availableTexts.length === 0}>
              Add text box
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="max-h-64 overflow-y-auto">
              {availableTexts.length === 0 ? (
                <ContextMenuItem disabled>
                  No text boxes uploaded
                </ContextMenuItem>
              ) : (
                availableTexts.map((text) => (
                  <ContextMenuItem
                    key={text.assetId}
                    onSelect={() => {
                      editorStore.addTextOverlay(text, sectionIndex);
                    }}
                  >
                    {text.title || text.assetId}
                  </ContextMenuItem>
                ))
              )}
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={() => {
              onEditEffects(sectionIndex);
            }}
          >
            Edit effects...
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => {
              editorStore.removeSection(sectionIndex);
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
