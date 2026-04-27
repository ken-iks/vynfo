import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { Button } from "../../ui/button";
import { EllipsisVerticalIcon } from "@heroicons/react/24/outline";
import { useSnapshot } from "valtio";
import { editorStore } from "../../stores/editor";
import type {
  MediaVideoMetadata,
  MediaImageMetadata,
  MediaTextMetadata,
} from "@/gen/proto/v1/projects_pb";

type AssetActionProps =
  | { type: "video"; metadata: MediaVideoMetadata }
  | { type: "image"; metadata: MediaImageMetadata }
  | { type: "text"; metadata: MediaTextMetadata };

export function AssetActions(props: AssetActionProps) {
  const snap = useSnapshot(editorStore);
  const canAddOverlay = snap.targetSectionIndex !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8">
          <EllipsisVerticalIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {props.type === "video" && (
          <DropdownMenuItem
            onSelect={() => {
              editorStore.addVideoSection(props.metadata);
            }}
          >
            Add to Editor
          </DropdownMenuItem>
        )}
        {props.type === "image" && (
          <DropdownMenuItem
            disabled={!canAddOverlay}
            onSelect={() => {
              editorStore.addImageOverlay(props.metadata);
            }}
          >
            Add to Current Section
          </DropdownMenuItem>
        )}
        {props.type === "text" && (
          <DropdownMenuItem
            disabled={!canAddOverlay}
            onSelect={() => {
              editorStore.addTextOverlay(props.metadata);
            }}
          >
            Add to Current Section
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
