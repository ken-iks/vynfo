import type {
  MediaImageMetadata,
  MediaTextMetadata,
  MediaVideoMetadata,
  PlaybackSection,
} from "@/gen/proto/v1/projects_pb";
import { PlaybackSectionSchema } from "@/gen/proto/v1/projects_pb";
import { fromJsonString, toJsonString } from "@bufbuild/protobuf";
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
  onInsertVideoAtTrackPx: (trackPx: number, video: MediaVideoMetadata) => void;
  onPasteSectionAtTrackPx: (trackPx: number, section: PlaybackSection) => void;
  onEditEffects: (sectionIndex: number) => void;
}

const COPIED_SECTION_STORAGE_KEY = "vynfo.timeline.copiedSection";

export function TimelineContextMenu({
  menuContext,
  availableVideos,
  availableImages,
  availableTexts,
  onInsertVideoAtTrackPx,
  onPasteSectionAtTrackPx,
  onEditEffects,
}: TimelineContextMenuProps) {
  const sectionIndex = menuContext?.sectionIndex ?? null;
  const hasCopiedSection =
    localStorage.getItem(COPIED_SECTION_STORAGE_KEY) !== null;
  const copySection = (index: number) => {
    const section = editorStore.sections[index];
    if (!section) return;
    localStorage.setItem(
      COPIED_SECTION_STORAGE_KEY,
      toJsonString(PlaybackSectionSchema, section),
    );
  };
  const pasteSection = () => {
    if (menuContext === null) return;
    const copiedSectionJson = localStorage.getItem(COPIED_SECTION_STORAGE_KEY);
    if (copiedSectionJson === null) return;
    const section = fromJsonString(PlaybackSectionSchema, copiedSectionJson);
    onPasteSectionAtTrackPx(menuContext.trackPx, section);
  };

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
              copySection(sectionIndex);
            }}
          >
            Copy selection
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
      <ContextMenuItem
        disabled={!hasCopiedSection || menuContext === null}
        onSelect={pasteSection}
      >
        Paste selection here
      </ContextMenuItem>
      <ContextMenuSeparator />
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
                  onInsertVideoAtTrackPx(menuContext.trackPx, video);
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
