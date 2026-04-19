import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { EllipsisVerticalIcon } from "@heroicons/react/24/outline";
import { editorStore } from "../stores/editor";
import type {
  MediaVideoMetadata,
  MediaImageMetadata,
  MediaTextMetadata,
} from "@/gen/proto/v1/api_pb";

type AssetActionProps =
  | { type: "video"; metadata: MediaVideoMetadata }
  | { type: "image"; metadata: MediaImageMetadata }
  | { type: "text"; metadata: MediaTextMetadata };

export function AssetActions(props: AssetActionProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
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
          <DropdownMenuItem disabled>Add to Editor (TODO)</DropdownMenuItem>
        )}
        {props.type === "text" && (
          <DropdownMenuItem disabled>Add to Editor (TODO)</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
