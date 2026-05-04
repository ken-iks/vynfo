import type { ProjectMetadata } from "@/gen/proto/v1/projects_pb";
import type { VfsEntry, VfsTreeRow } from "./vfsTypes";
import { VfsEntryRow } from "./VfsEntryRow";

export interface VfsTreeProps {
  busyAction: string;
  loading: boolean;
  projects: ProjectMetadata[];
  rows: VfsTreeRow[];
  onAddToProject: (entry: VfsEntry, projectId: string) => void;
  onCreateFolder: (entry: VfsEntry) => void;
  onDelete: (entry: VfsEntry) => void;
  onMove: (entry: VfsEntry) => void;
  onRename: (entry: VfsEntry) => void;
  onToggleDirectory: (entry: VfsEntry) => void;
  onUpload: (entry: VfsEntry) => void;
}

export function VfsTree({
  busyAction,
  loading,
  projects,
  rows,
  onAddToProject,
  onCreateFolder,
  onDelete,
  onMove,
  onRename,
  onToggleDirectory,
  onUpload,
}: VfsTreeProps) {
  if (loading && rows.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Loading filesystem...
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        This folder is empty.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded border">
      {rows.map((row) => (
        <VfsEntryRow
          key={`${row.entry.entryType}:${row.entry.id}`}
          entry={row.entry}
          busy={busyAction.endsWith(row.entry.id)}
          depth={row.depth}
          expanded={row.expanded}
          loading={row.loading}
          projects={projects}
          onToggleDirectory={() => onToggleDirectory(row.entry)}
          onRename={() => onRename(row.entry)}
          onMove={() => onMove(row.entry)}
          onDelete={() => onDelete(row.entry)}
          onCreateFolder={() => onCreateFolder(row.entry)}
          onUpload={() => onUpload(row.entry)}
          onAddToProject={(projectId) => onAddToProject(row.entry, projectId)}
        />
      ))}
    </div>
  );
}
