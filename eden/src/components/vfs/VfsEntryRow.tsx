import {
  ChevronDownIcon,
  ChevronRightIcon,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { VfsEntry } from "./vfsTypes";

type VfsEntryRowProps = {
  entry: VfsEntry;
  busy: boolean;
  depth: number;
  expanded: boolean;
  loading: boolean;
  projects: ProjectMetadata[];
  onToggleDirectory: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
  onCreateFolder: () => void;
  onUpload: () => void;
  onAddToProject: (projectId: string) => void;
};

export function VfsEntryRow({
  entry,
  busy,
  depth,
  expanded,
  loading,
  projects,
  onToggleDirectory,
  onRename,
  onMove,
  onDelete,
  onCreateFolder,
  onUpload,
  onAddToProject,
}: VfsEntryRowProps) {
  const icon =
    entry.entryType === "directory" ? (
      <FolderIcon className="size-5 text-amber-500" />
    ) : entry.kind === "video" ? (
      <VideoCameraIcon className="size-5 text-sky-500" />
    ) : entry.kind === "image" ? (
      <PhotoIcon className="size-5 text-emerald-500" />
    ) : entry.kind === "audio" ? (
      <SpeakerWaveIcon className="size-5 text-violet-500" />
    ) : (
      <DocumentIcon className="size-5 text-muted-foreground" />
    );
  const kindLabel = entry.entryType === "directory" ? "Folder" : entry.kind;
  const addToProjectLabel =
    entry.entryType === "directory"
      ? "Add Folder Assets to Project"
      : "Add to Project";
  const rowBusy = busy || loading;

  return (
    <div className="flex items-center border-b last:border-b-0 hover:bg-muted/50">
      <div className="min-w-0 flex-1">
        <button
          type="button"
          className="flex w-full items-center gap-3 px-3 py-3 text-left disabled:opacity-50"
          style={{ paddingLeft: `${depth * 1.25 + 0.75}rem` }}
          onClick={entry.entryType === "directory" ? onToggleDirectory : undefined}
          disabled={rowBusy}
        >
          {entry.entryType === "directory" ? (
            expanded ? (
              <ChevronDownIcon className="size-4 text-muted-foreground" />
            ) : (
              <ChevronRightIcon className="size-4 text-muted-foreground" />
            )
          ) : (
            <span className="size-4" />
          )}
          {icon}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{entry.name}</p>
            <p className="text-xs capitalize text-muted-foreground">
              {kindLabel}
            </p>
          </div>
          {entry.entryType === "directory" && (
            <span className="text-xs text-muted-foreground">
              {loading ? "Loading" : expanded ? "Collapse" : "Expand"}
            </span>
          )}
        </button>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mr-2 size-8 shrink-0"
            disabled={rowBusy}
            onClick={(event) => event.stopPropagation()}
          >
            <EllipsisVerticalIcon className="size-4" />
            <span className="sr-only">Open actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {entry.entryType === "directory" && (
            <DropdownMenuItem onSelect={onToggleDirectory}>
              {expanded ? "Collapse" : "Expand"}
            </DropdownMenuItem>
          )}
          {entry.entryType === "directory" && (
            <>
              <DropdownMenuItem onSelect={onCreateFolder}>
                New Folder Here
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onUpload}>Upload Here</DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem onSelect={onRename}>Rename</DropdownMenuItem>
          <DropdownMenuItem onSelect={onMove}>Move</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>{addToProjectLabel}</DropdownMenuSubTrigger>
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
  );
}
