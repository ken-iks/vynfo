import {
  DocumentIcon,
  EllipsisVerticalIcon,
  FolderIcon,
  PhotoIcon,
  SpeakerWaveIcon,
  VideoCameraIcon,
} from "@heroicons/react/24/outline";
import type { ProjectMetadata } from "@/gen/proto/v1/projects_pb";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/utils/timestamp-conversaions";
import type { VfsEntry } from "./vfsTypes";

type VfsCardProps = {
  entry: VfsEntry;
  busy: boolean;
  projects: ProjectMetadata[];
  onOpen: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
  onCreateFolder: () => void;
  onUpload: () => void;
  onAddToProject: (projectId: string) => void;
};

function entrySubtitle(entry: VfsEntry): string {
  if (entry.entryType === "directory") return "Folder";
  if (entry.kind === "video") {
    return entry.video
      ? `Video · ${formatDuration(entry.video.duration * 1000)}`
      : "Video";
  }
  if (entry.kind === "audio") {
    return entry.audio
      ? `Audio · ${formatDuration(entry.audio.duration * 1000)}`
      : "Audio";
  }
  return "Image";
}

function ThumbnailContent({ entry }: { entry: VfsEntry }) {
  if (entry.entryType === "directory") {
    return <FolderIcon className="size-10 text-amber-500" />;
  }
  if (entry.kind === "image") {
    return entry.image?.signedUrl ? (
      <img
        src={entry.image.signedUrl}
        alt={entry.name}
        className="size-full object-cover"
      />
    ) : (
      <PhotoIcon className="size-10 text-emerald-500" />
    );
  }
  if (entry.kind === "video") {
    // A future MediaVideoMetadata.thumbnailUrl will render here instead.
    return <VideoCameraIcon className="size-10 text-sky-500" />;
  }
  if (entry.kind === "audio") {
    return <SpeakerWaveIcon className="size-10 text-violet-500" />;
  }
  return <DocumentIcon className="size-10 text-muted-foreground" />;
}

export function VfsCard({
  entry,
  busy,
  projects,
  onOpen,
  onRename,
  onMove,
  onDelete,
  onCreateFolder,
  onUpload,
  onAddToProject,
}: VfsCardProps) {
  const isDirectory = entry.entryType === "directory";
  const addToProjectLabel = isDirectory
    ? "Add Folder Assets to Project"
    : "Add to Project";

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "group/card relative flex flex-col overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10 transition-colors",
            isDirectory && "cursor-pointer hover:bg-muted/50",
            busy && "pointer-events-none opacity-50",
          )}
          onDoubleClick={isDirectory ? onOpen : undefined}
          onClick={isDirectory ? onOpen : undefined}
        >
          <div className="flex aspect-square items-center justify-center bg-muted/30">
            <ThumbnailContent entry={entry} />
          </div>
          <div className="flex min-w-0 items-center gap-1 border-t px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{entry.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {entrySubtitle(entry)}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 opacity-0 group-hover/card:opacity-100 data-[state=open]:opacity-100"
                  onClick={(event) => event.stopPropagation()}
                >
                  <EllipsisVerticalIcon className="size-4" />
                  <span className="sr-only">Open actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {isDirectory && (
                  <>
                    <DropdownMenuItem onSelect={onCreateFolder}>
                      New Folder Here
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={onUpload}>
                      Upload Here
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem onSelect={onRename}>Rename</DropdownMenuItem>
                <DropdownMenuItem onSelect={onMove}>Move</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    {addToProjectLabel}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-56">
                    {projects.length > 0 ? (
                      projects.map((project) => (
                        <DropdownMenuItem
                          key={project.id}
                          onSelect={() => onAddToProject(project.id)}
                        >
                          {project.name}
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <DropdownMenuItem disabled>No projects</DropdownMenuItem>
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {isDirectory && (
          <>
            <ContextMenuItem onSelect={onOpen}>Open</ContextMenuItem>
            <ContextMenuItem onSelect={onCreateFolder}>
              New Folder Here
            </ContextMenuItem>
            <ContextMenuItem onSelect={onUpload}>Upload Here</ContextMenuItem>
          </>
        )}
        <ContextMenuItem onSelect={onRename}>Rename</ContextMenuItem>
        <ContextMenuItem onSelect={onMove}>Move</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger>{addToProjectLabel}</ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-56">
            {projects.length > 0 ? (
              projects.map((project) => (
                <ContextMenuItem
                  key={project.id}
                  onSelect={() => onAddToProject(project.id)}
                >
                  {project.name}
                </ContextMenuItem>
              ))
            ) : (
              <ContextMenuItem disabled>No projects</ContextMenuItem>
            )}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onSelect={onDelete}>
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
