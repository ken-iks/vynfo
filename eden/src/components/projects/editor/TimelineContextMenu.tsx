import type {
  MediaAudioMetadata,
  MediaImageMetadata,
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
  audioSectionIndex: number | null;
}

interface TimelineContextMenuProps {
  menuContext: TimelineMenuContext | null;
  availableVideos: MediaVideoMetadata[];
  availableAudios: MediaAudioMetadata[];
  availableImages: MediaImageMetadata[];
  onInsertVideoAtTrackPx: (trackPx: number, video: MediaVideoMetadata) => void;
  onInsertAudioAtTrackPx: (trackPx: number, audio: MediaAudioMetadata) => void;
  onCutAtTrackPx: (
    trackPx: number,
    sectionIndex: number | null,
    audioSectionIndex: number | null,
  ) => void;
  onPasteSectionAtTrackPx: (trackPx: number, section: PlaybackSection) => void;
  onEditEffects: (sectionIndex: number) => void;
}

const COPIED_SECTION_STORAGE_KEY = "vynfo.timeline.copiedSection";

function readCopiedSection() {
  const copiedSectionJson = localStorage.getItem(COPIED_SECTION_STORAGE_KEY);
  if (copiedSectionJson === null) return undefined;
  try {
    return fromJsonString(PlaybackSectionSchema, copiedSectionJson);
  } catch {
    localStorage.removeItem(COPIED_SECTION_STORAGE_KEY);
    return undefined;
  }
}

export function TimelineContextMenu({
  menuContext,
  availableVideos,
  availableAudios,
  availableImages,
  onInsertVideoAtTrackPx,
  onInsertAudioAtTrackPx,
  onCutAtTrackPx,
  onPasteSectionAtTrackPx,
  onEditEffects,
}: TimelineContextMenuProps) {
  const sectionIndex = menuContext?.sectionIndex ?? null;
  const audioSectionIndex = menuContext?.audioSectionIndex ?? null;
  const hasSectionSelection =
    sectionIndex !== null || audioSectionIndex !== null;
  const availableVideoIds = new Set(
    availableVideos.map((video) => video.assetId).filter(Boolean),
  );
  const availableImageIds = new Set(
    availableImages.map((image) => image.assetId).filter(Boolean),
  );
  const copiedSection = readCopiedSection();
  const canPasteSection =
    copiedSection !== undefined &&
    (copiedSection.video?.meta?.assetId === undefined ||
      copiedSection.video.meta.assetId === "" ||
      availableVideoIds.has(copiedSection.video.meta.assetId)) &&
    copiedSection.overlays.every((overlay) => {
      if (overlay.kind.case !== "image") return true;
      const assetId = overlay.kind.value.assetId;
      return assetId === "" || availableImageIds.has(assetId);
    });
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
    if (!canPasteSection || copiedSection === undefined) return;
    onPasteSectionAtTrackPx(menuContext.trackPx, copiedSection);
  };

  return (
    <ContextMenuContent>
      {hasSectionSelection && menuContext !== null && (
        <>
          <ContextMenuItem
            onSelect={() => {
              onCutAtTrackPx(
                menuContext.trackPx,
                sectionIndex,
                audioSectionIndex,
              );
            }}
          >
            Cut here
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      )}
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
          <ContextMenuItem
            onSelect={() => {
              editorStore.addTextOverlay("", sectionIndex);
            }}
          >
            Add text
          </ContextMenuItem>
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
        disabled={!canPasteSection || menuContext === null}
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
      <ContextMenuSub>
        <ContextMenuSubTrigger disabled={availableAudios.length === 0}>
          Insert audio here
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="max-h-64 overflow-y-auto">
          {availableAudios.length === 0 ? (
            <ContextMenuItem disabled>No audio uploaded</ContextMenuItem>
          ) : (
            availableAudios.map((audio) => (
              <ContextMenuItem
                key={audio.assetId}
                onSelect={() => {
                  if (menuContext === null) return;
                  onInsertAudioAtTrackPx(menuContext.trackPx, audio);
                }}
              >
                {audio.title || audio.assetId}
              </ContextMenuItem>
            ))
          )}
        </ContextMenuSubContent>
      </ContextMenuSub>
    </ContextMenuContent>
  );
}
