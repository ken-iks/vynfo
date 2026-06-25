import type { ProjectMetadata } from "@/gen/proto/v1/projects_pb";
import type { VfsEntry } from "./vfsTypes";
import { VfsCard } from "./VfsCard";

export interface VfsGridProps {
  busyAction: string;
  loading: boolean;
  projects: ProjectMetadata[];
  entries: VfsEntry[];
  onOpenDirectory: (entry: VfsEntry) => void;
  onCreateFolder: (entry: VfsEntry) => void;
  onDelete: (entry: VfsEntry) => void;
  onMove: (entry: VfsEntry) => void;
  onRename: (entry: VfsEntry) => void;
  onUpload: (entry: VfsEntry) => void;
  onAddToProject: (entry: VfsEntry, projectId: string) => void;
}

export function VfsGrid({
  busyAction,
  loading,
  projects,
  entries,
  onOpenDirectory,
  onCreateFolder,
  onDelete,
  onMove,
  onRename,
  onUpload,
  onAddToProject,
}: VfsGridProps) {
  if (loading && entries.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Loading filesystem...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        This folder is empty.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {entries.map((entry) => (
        <VfsCard
          key={`${entry.entryType}:${entry.id}`}
          entry={entry}
          busy={busyAction.endsWith(entry.id)}
          projects={projects}
          onOpen={() => onOpenDirectory(entry)}
          onRename={() => onRename(entry)}
          onMove={() => onMove(entry)}
          onDelete={() => onDelete(entry)}
          onCreateFolder={() => onCreateFolder(entry)}
          onUpload={() => onUpload(entry)}
          onAddToProject={(projectId) => onAddToProject(entry, projectId)}
        />
      ))}
    </div>
  );
}
